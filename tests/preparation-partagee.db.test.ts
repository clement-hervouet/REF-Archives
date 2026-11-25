/**
 * Préparation partagée sur une vraie base PostgreSQL (migration 035) : la règle d'accès
 * (`VALID_SHARE`) et les écritures croisées ne se vérifient vraiment qu'avec le SQL réel.
 *
 * Facultatif : ignoré sans `DATABASE_URL` (CI). En local : `pnpm db:seed` puis
 * `pnpm test:db`. Tout se passe dans une transaction annulée à la fin : la base de
 * développement n'est pas modifiée. S'appuie sur le match complet du seed (un collègue
 * arbitre 2).
 */
import pg from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { preparationFieldsSchema, preparationFormSchema } from "@/lib/schemas/preparations";
import { seasonStartOf } from "@/lib/seasons";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { listLinkedOwners, listOwnerLinks } from "@/server/db/colleague-links";
import { findAlreadyRefereed, listPreparations } from "@/server/db/preparations";
import {
  deleteStaleShares,
  findRecipientGame,
  findRecipientPreparation,
  findShareLinkPreview,
  listRecipientPreparations,
  listShareCandidates,
  listShareRecipients,
} from "@/server/db/shared-preparations";
import type { Queryable } from "@/server/db/users";
import { saveGamePreparation } from "@/server/games/manage-preparation";
import { acceptShareLink } from "@/server/sharing/accept-share-link";
import { createLink, shareWithColleague, unlinkFromOwner } from "@/server/sharing/manage-sharing";
import { saveSharedPreparation } from "@/server/sharing/recipient-preparation";

// Données du seed (`db/seed.sql`).
const OWNER = "00000000-0000-4000-8000-000000000001";
const GAME = "00000000-0000-4000-8000-000000000091";
const PERSON = "00000000-0000-4000-8000-0000000000b2";

const TEAM = { rank: "", wins: "", losses: "", players: "", coaches: "", alreadyRefereed: false };
const CREW = { placement: "", communication: "", management: "", table: "", contact: "" };
const form = (values: Record<string, unknown>) => ({
  teamCount: "",
  team1: TEAM,
  team2: TEAM,
  crew: CREW,
  observed: false,
  ...values,
});
const FILTERS = {
  category: null,
  type: null,
  level: null,
  clubId: null,
  includeWithoutNote: false,
  page: 1,
};

describe.skipIf(process.env.DATABASE_URL === undefined)(
  "préparation partagée (base réelle)",
  () => {
    let client: pg.Client;
    let db: Queryable;
    let transaction: <T>(action: (tx: Queryable) => Promise<T>) => Promise<T>;
    let recipient: string;
    let intruder: string;

    async function createUser(email: string, firstname: string, lastname: string) {
      const result = await client.query(
        `INSERT INTO "user" (email, password_hash, firstname, lastname) VALUES ($1, 'x', $2, $3)
RETURNING id`,
        [email, firstname, lastname],
      );
      return z.object({ id: z.uuid() }).parse(result.rows[0]).id;
    }

    /** Lien créé par le propriétaire pour l'arbitre 2 du match du seed : son jeton. */
    async function linkToken(): Promise<string> {
      let token = "";
      const deps = {
        transaction,
        now: () => new Date(),
        appUrl: "https://ref.test",
        generateToken: () => {
          const generated = generateToken();
          token = generated.token;
          return generated;
        },
      };
      expect((await createLink(deps, OWNER, { gameId: GAME, personId: PERSON })).status).toBe(
        "link_created",
      );
      return token;
    }

    const acceptDeps = () => ({
      transaction,
      now: () => new Date(),
      admitAttempt: () => Promise.resolve({ admitted: true as const }),
    });

    beforeEach(async () => {
      client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      await client.query("BEGIN");
      db = { query: (text, values) => client.query(text, values) };
      transaction = (action) => action(db);
      await client.query(
        `UPDATE "user" SET firstname = 'Clément', lastname = 'Hervouet' WHERE id = $1`,
        [OWNER],
      );
      recipient = await createUser("collegue@example.test", "Julien", "Dupont");
      intruder = await createUser("intrus@example.test", "Eve", "Intruse");
    });

    afterEach(async () => {
      await client.query("ROLLBACK");
      await client.end();
    });

    it("lie les comptes à l'acceptation d'un lien à usage unique", async () => {
      const token = await linkToken();
      expect(await findShareLinkPreview(db, hashToken(token))).toMatchObject({
        owner: { userId: OWNER, firstname: "Clément" },
      });
      expect(
        await acceptShareLink(acceptDeps(), { token, viewerId: OWNER, reverse: { kind: "none" } }),
      ).toEqual({ status: "own_link" });
      expect(
        await acceptShareLink(acceptDeps(), {
          token,
          viewerId: recipient,
          reverse: { kind: "create" },
        }),
      ).toMatchObject({ status: "accepted", gameId: GAME, newlyLinked: true });
      // Usage unique.
      expect(
        await acceptShareLink(acceptDeps(), {
          token,
          viewerId: intruder,
          reverse: { kind: "none" },
        }),
      ).toEqual({ status: "invalid" });

      expect((await listOwnerLinks(db, OWNER)).get(PERSON)?.userId).toBe(recipient);
      expect((await listLinkedOwners(db, recipient)).map((owner) => owner.userId)).toEqual([OWNER]);
      // Fiche « Clément Hervouet » créée chez le destinataire et liée au propriétaire.
      expect([...(await listOwnerLinks(db, recipient)).values()][0]?.userId).toBe(OWNER);
      expect(await listShareCandidates(db, { gameId: GAME, ownerUserId: OWNER })).toMatchObject([
        { personId: PERSON, shared: true, linked: { userId: recipient } },
      ]);
    });

    it("partage la préparation commune, chacun gardant ses cases", async () => {
      const token = await linkToken();
      await acceptShareLink(acceptDeps(), {
        token,
        viewerId: recipient,
        reverse: { kind: "none" },
      });
      const empty = preparationFieldsSchema.parse(form({}));
      const first = preparationFormSchema.parse(
        form({
          teamCount: "10",
          team1: { ...TEAM, alreadyRefereed: true },
          crew: { ...CREW, placement: "Large" },
        }),
      );
      // Le destinataire écrit en premier : la préparation reste au propriétaire, et ses
      // cases prennent son propre calcul « déjà arbitrée » (pas celles du destinataire).
      const startsAt = await client.query("SELECT starts_at FROM game WHERE id = $1", [GAME]);
      const ownerDefaults = await findAlreadyRefereed(db, {
        userId: OWNER,
        gameId: GAME,
        seasonFrom: seasonStartOf(
          z.object({ starts_at: z.date() }).parse(startsAt.rows[0]).starts_at,
        ),
      });
      expect(
        await saveSharedPreparation({ transaction }, recipient, GAME, {
          preparation: first,
          base: empty,
        }),
      ).toEqual({ status: "saved" });
      const row = await client.query(
        `SELECT user_id, updated_by, team1_already_refereed, team2_already_refereed
FROM game_preparation WHERE game_id = $1 AND deleted_at IS NULL`,
        [GAME],
      );
      expect(row.rows[0]).toEqual({
        user_id: OWNER,
        updated_by: recipient,
        team1_already_refereed: ownerDefaults?.team1,
        team2_already_refereed: ownerDefaults?.team2,
      });
      expect(
        (await listShareRecipients(db, { gameId: GAME, ownerUserId: OWNER }))[0],
      ).toMatchObject({
        userId: recipient,
        checks: { team1: true, team2: false },
      });

      // Le propriétaire coche sa case et écrit la table ; le destinataire, ensuite, en conflit
      // sur la table puis sur un autre champ.
      const current = await findRecipientPreparation(db, { gameId: GAME, viewerId: recipient });
      if (current === null) throw new Error("préparation attendue");
      const ownerSave = {
        ...current,
        team2: { ...current.team2, alreadyRefereed: true },
        crew: { ...current.crew, table: "Lente" },
      };
      expect(
        await saveGamePreparation({ transaction }, OWNER, GAME, {
          preparation: ownerSave,
          base: current,
        }),
      ).toEqual({ status: "saved" });
      expect(
        await saveSharedPreparation({ transaction }, recipient, GAME, {
          preparation: { ...first, crew: { ...first.crew, table: "Rapide" } },
          base: first,
        }),
      ).toMatchObject({ status: "conflict", conflicts: ["table"], saved: { table: "Lente" } });
      expect(
        await saveSharedPreparation({ transaction }, recipient, GAME, {
          preparation: { ...first, crew: { ...first.crew, contact: "Tolérant" } },
          base: first,
        }),
      ).toEqual({ status: "saved" });
      const after = await client.query(
        `SELECT team2_already_refereed, crew_table, crew_contact FROM game_preparation
WHERE game_id = $1 AND deleted_at IS NULL`,
        [GAME],
      );
      expect(after.rows[0]).toEqual({
        team2_already_refereed: true,
        crew_table: "Lente",
        crew_contact: "Tolérant",
      });

      const mine = await listPreparations(db, { userId: OWNER, filters: FILTERS });
      expect(mine.items.find((item) => item.gameId === GAME)?.shared).toBe(true);
      expect(
        (await listRecipientPreparations(db, { viewerId: recipient, filters: FILTERS })).items,
      ).toMatchObject([{ gameId: GAME, sharedBy: { firstname: "Clément" }, teamCount: 10 }]);
    });

    it("refuse tout accès à un compte sans partage valide", async () => {
      const token = await linkToken();
      await acceptShareLink(acceptDeps(), {
        token,
        viewerId: recipient,
        reverse: { kind: "none" },
      });
      const preparation = preparationFormSchema.parse(form({ teamCount: "10" }));
      const empty = preparationFieldsSchema.parse(form({}));

      expect(await findRecipientGame(db, { gameId: GAME, viewerId: intruder })).toBeNull();
      expect(
        await saveSharedPreparation({ transaction }, intruder, GAME, { preparation, base: empty }),
      ).toEqual({ status: "not_found" });
      expect(
        (await listRecipientPreparations(db, { viewerId: intruder, filters: FILTERS })).items,
      ).toEqual([]);

      // Arbitre retiré du match : plus d'accès ; remis, le propriétaire repartage en un clic.
      await client.query("UPDATE game SET referee2_id = NULL WHERE id = $1", [GAME]);
      await deleteStaleShares(db, { gameId: GAME, ownerUserId: OWNER });
      expect(await findRecipientGame(db, { gameId: GAME, viewerId: recipient })).toBeNull();
      await client.query("UPDATE game SET referee2_id = $2 WHERE id = $1", [GAME, PERSON]);
      expect(
        await shareWithColleague({ transaction }, OWNER, { gameId: GAME, personId: PERSON }),
      ).toEqual({
        status: "shared",
      });
      expect(await findRecipientGame(db, { gameId: GAME, viewerId: recipient })).not.toBeNull();

      // Suppression programmée du compte du propriétaire, puis du destinataire : plus
      // d'accès ; annuler la suppression le rétablit.
      for (const account of [OWNER, recipient]) {
        await client.query(
          `UPDATE "user" SET deletion_due_at = now() + interval '7 days' WHERE id = $1`,
          [account],
        );
        expect(await findRecipientGame(db, { gameId: GAME, viewerId: recipient })).toBeNull();
        await client.query(`UPDATE "user" SET deletion_due_at = NULL WHERE id = $1`, [account]);
        expect(await findRecipientGame(db, { gameId: GAME, viewerId: recipient })).not.toBeNull();
      }

      // Match supprimé : plus d'accès.
      await client.query("UPDATE game SET deleted_at = now() WHERE id = $1", [GAME]);
      expect(await findRecipientGame(db, { gameId: GAME, viewerId: recipient })).toBeNull();
      await client.query("UPDATE game SET deleted_at = NULL WHERE id = $1", [GAME]);

      // Le destinataire se délie : partages retirés, et il faut un nouveau lien.
      expect(await unlinkFromOwner({ transaction }, recipient, OWNER)).toBe(true);
      expect(await findRecipientGame(db, { gameId: GAME, viewerId: recipient })).toBeNull();
      expect(
        await shareWithColleague({ transaction }, OWNER, { gameId: GAME, personId: PERSON }),
      ).toEqual({
        status: "not_linked",
      });
    });
  },
);
