"use client";

/**
 * Champ de texte riche (notes de match, préparations, axes d'amélioration) : éditeur TipTap
 * avec barre d'outils, dont le contenu part dans le formulaire en Markdown par un champ
 * caché. Remplace un `<textarea>` : même nom de champ, même valeur de départ, même limite
 * (comptée sur le Markdown, mise en forme comprise ; le serveur revalide tout).
 *
 * Barre d'outils (WAI-ARIA « toolbar ») : un seul arrêt de tabulation, flèches gauche et
 * droite, Début et Fin pour passer d'un bouton à l'autre. Les boutons ne prennent pas le
 * focus à la souris : la sélection reste dans le texte.
 */
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import {
  AArrowDown,
  AArrowUp,
  Bold,
  Highlighter,
  Italic,
  List,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  ListTodo,
  Redo2,
  RemoveFormatting,
  SeparatorHorizontal,
  Strikethrough,
  TextQuote,
  Underline,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { fr } from "@/i18n/fr";
import { richTextExtensions } from "@/lib/rich-text/extensions";
import { headingLevelOf, nextTextSize } from "@/lib/rich-text/sizes";
import type { TextSize } from "@/lib/rich-text/sizes";
import { cn } from "@/lib/utils";

const t = fr.richText;

/**
 * Hauteur minimale de la zone de saisie, comme les `rows` d'un textarea ; elle grandit
 * ensuite avec le contenu. `xs` : deux lignes environ, pour une liste de champs courts.
 */
const MIN_HEIGHT = { xs: "min-h-16", sm: "min-h-24", md: "min-h-32", lg: "min-h-40" } as const;

type Props = {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  maxLength: number;
  error: string | null;
  /** Aide affichée sous le champ (sinon seulement lue par les lecteurs d'écran). */
  hint?: string;
  hintVisible?: boolean;
  height?: keyof typeof MIN_HEIGHT;
  labelClassName?: string;
};

type Action = {
  key: string;
  label: string;
  icon: LucideIcon;
  run: (editor: Editor) => void;
  /** État de bouton bascule (`aria-pressed`), absent pour une action simple. */
  pressed?: boolean;
  disabled?: boolean;
};

function currentSize(editor: Editor): TextSize {
  if (editor.isActive("smallText")) return "small";
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  return "normal";
}

function setSize(editor: Editor, size: TextSize): boolean {
  const level = headingLevelOf(size);
  const chain = editor.chain().focus();
  if (level !== null) return chain.setHeading({ level }).run();
  return size === "small" ? chain.setNode("smallText").run() : chain.setParagraph().run();
}

function canSetSize(editor: Editor, size: TextSize | null): boolean {
  if (size === null) return false;
  const level = headingLevelOf(size);
  const can = editor.can();
  if (level !== null) return can.setHeading({ level });
  return size === "small" ? can.setNode("smallText") : can.setParagraph();
}

/** État de la barre d'outils, relu à chaque transaction (sélection ou contenu). */
function useToolbarState(editor: Editor | null) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (e === null) return null;
      const size = currentSize(e);
      const smaller = nextTextSize(size, -1);
      const bigger = nextTextSize(size, 1);
      return {
        size,
        smaller,
        bigger,
        canSmaller: canSetSize(e, smaller),
        canBigger: canSetSize(e, bigger),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        highlight: e.isActive("highlight"),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        taskList: e.isActive("taskList"),
        blockquote: e.isActive("blockquote"),
        canSink: e.can().sinkListItem("listItem") || e.can().sinkListItem("taskItem"),
        canLift: e.can().liftListItem("listItem") || e.can().liftListItem("taskItem"),
      };
    },
  });
}

type ToolbarState = NonNullable<ReturnType<typeof useToolbarState>>;

function sinkOrLift(editor: Editor, direction: "sink" | "lift"): void {
  const type = editor.isActive("taskItem") ? "taskItem" : "listItem";
  const chain = editor.chain().focus();
  if (direction === "sink") chain.sinkListItem(type).run();
  else chain.liftListItem(type).run();
}

/** Boutons, par groupes séparés visuellement. */
function toolbarGroups(s: ToolbarState): Action[][] {
  return [
    [
      {
        key: "undo",
        label: t.undo,
        icon: Undo2,
        run: (e) => e.chain().focus().undo().run(),
        disabled: !s.canUndo,
      },
      {
        key: "redo",
        label: t.redo,
        icon: Redo2,
        run: (e) => e.chain().focus().redo().run(),
        disabled: !s.canRedo,
      },
    ],
    [
      {
        key: "smaller",
        label: t.smaller,
        icon: AArrowDown,
        run: (e) => s.smaller !== null && setSize(e, s.smaller),
        disabled: !s.canSmaller,
      },
      {
        key: "bigger",
        label: t.bigger,
        icon: AArrowUp,
        run: (e) => s.bigger !== null && setSize(e, s.bigger),
        disabled: !s.canBigger,
      },
    ],
    [
      {
        key: "bold",
        label: t.bold,
        icon: Bold,
        run: (e) => e.chain().focus().toggleBold().run(),
        pressed: s.bold,
      },
      {
        key: "italic",
        label: t.italic,
        icon: Italic,
        run: (e) => e.chain().focus().toggleItalic().run(),
        pressed: s.italic,
      },
      {
        key: "underline",
        label: t.underline,
        icon: Underline,
        run: (e) => e.chain().focus().toggleUnderline().run(),
        pressed: s.underline,
      },
      {
        key: "strike",
        label: t.strike,
        icon: Strikethrough,
        run: (e) => e.chain().focus().toggleStrike().run(),
        pressed: s.strike,
      },
      {
        key: "highlight",
        label: t.highlight,
        icon: Highlighter,
        run: (e) => e.chain().focus().toggleHighlight().run(),
        pressed: s.highlight,
      },
    ],
    [
      {
        key: "bulletList",
        label: t.bulletList,
        icon: List,
        run: (e) => e.chain().focus().toggleBulletList().run(),
        pressed: s.bulletList,
      },
      {
        key: "orderedList",
        label: t.orderedList,
        icon: ListOrdered,
        run: (e) => e.chain().focus().toggleOrderedList().run(),
        pressed: s.orderedList,
      },
      {
        key: "taskList",
        label: t.taskList,
        icon: ListTodo,
        run: (e) => e.chain().focus().toggleTaskList().run(),
        pressed: s.taskList,
      },
      {
        key: "lift",
        label: t.liftItem,
        icon: ListIndentDecrease,
        run: (e) => {
          sinkOrLift(e, "lift");
        },
        disabled: !s.canLift,
      },
      {
        key: "sink",
        label: t.sinkItem,
        icon: ListIndentIncrease,
        run: (e) => {
          sinkOrLift(e, "sink");
        },
        disabled: !s.canSink,
      },
    ],
    [
      {
        key: "blockquote",
        label: t.blockquote,
        icon: TextQuote,
        run: (e) => e.chain().focus().toggleBlockquote().run(),
        pressed: s.blockquote,
      },
      {
        key: "horizontalRule",
        label: t.horizontalRule,
        icon: SeparatorHorizontal,
        run: (e) => e.chain().focus().setHorizontalRule().run(),
      },
      {
        key: "clear",
        label: t.clear,
        icon: RemoveFormatting,
        run: (e) => e.chain().focus().unsetAllMarks().clearNodes().run(),
      },
    ],
  ];
}

function Toolbar({ editor, label, controls }: { editor: Editor; label: string; controls: string }) {
  const state = useToolbarState(editor);
  const [activeIndex, setActiveIndex] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  if (state === null) return null;
  const groups = toolbarGroups(state);
  const count = groups.reduce((total, group) => total + group.length, 0);
  // Position du premier bouton de chaque groupe dans la barre (navigation au clavier).
  const offsets = groups.map((_, groupIndex) =>
    groups.slice(0, groupIndex).reduce((total, group) => total + group.length, 0),
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowRight: activeIndex + 1,
      ArrowLeft: activeIndex - 1,
      Home: 0,
      End: count - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = (target + count) % count;
    setActiveIndex(next);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="toolbar"
      aria-label={t.toolbar.replace("{label}", label)}
      aria-controls={controls}
      onKeyDown={onKeyDown}
      // Téléphone : une ligne qui défile ; ordinateur : passe à la ligne, tout reste visible.
      className="flex items-center gap-0.5 overflow-x-auto border-b border-border p-1 md:flex-wrap md:overflow-visible"
    >
      <span className="sr-only" aria-live="polite">
        {t.size.replace("{size}", t.sizes[state.size])}
      </span>
      {groups.map((group, groupIndex) => (
        <Fragment key={group[0]?.key ?? groupIndex}>
          {groupIndex > 0 && (
            <span aria-hidden="true" className="mx-0.5 h-6 w-px shrink-0 bg-border" />
          )}
          {group.map((action, actionIndex) => {
            const position = (offsets[groupIndex] ?? 0) + actionIndex;
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                ref={(element) => {
                  buttons.current[position] = element;
                }}
                type="button"
                tabIndex={position === activeIndex ? 0 : -1}
                aria-label={action.label}
                title={action.label}
                aria-pressed={action.pressed}
                // `aria-disabled` plutôt que `disabled` : le bouton reste atteignable au clavier.
                aria-disabled={action.disabled === true}
                // La souris ne vole pas le focus : la sélection du texte reste en place.
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  setActiveIndex(position);
                  if (action.disabled !== true) action.run(editor);
                }}
                className={cn(
                  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md md:h-9 md:w-9",
                  "hover:bg-accent aria-disabled:opacity-40 aria-disabled:hover:bg-transparent",
                  "aria-pressed:bg-accent aria-pressed:text-accent-foreground",
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

/** Attributs de la zone éditable : rôle et liens ARIA d'un textarea. */
function editorAttributes(input: {
  id: string;
  labelId: string;
  describedBy: string;
  invalid: boolean;
  height: keyof typeof MIN_HEIGHT;
}): Record<string, string> {
  return {
    id: input.id,
    role: "textbox",
    "aria-multiline": "true",
    "aria-labelledby": input.labelId,
    "aria-describedby": input.describedBy,
    "aria-invalid": String(input.invalid),
    class: cn("rich-text px-3 py-2 outline-none", MIN_HEIGHT[input.height]),
  };
}

export function RichTextField({
  id,
  name,
  label,
  defaultValue,
  maxLength,
  error,
  hint = t.shortcuts,
  hintVisible = false,
  height = "md",
  labelClassName = "text-sm font-medium",
}: Props) {
  const [markdown, setMarkdown] = useState(defaultValue);
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const countId = `${id}-count`;
  const errorId = `${id}-error`;
  const tooLong = markdown.length > maxLength;
  const showCount = markdown.length > maxLength * 0.8;
  const describedBy = [hintId, showCount ? countId : null, error !== null ? errorId : null]
    .filter((value) => value !== null)
    .join(" ");

  const invalid = error !== null || tooLong;
  const attributes = editorAttributes({ id, labelId, describedBy, invalid, height });
  const editor = useEditor({
    extensions: [...richTextExtensions(), Markdown.configure({ markedOptions: { breaks: true } })],
    content: defaultValue,
    contentType: "markdown",
    // Rendu côté client seulement : évite un écart d'hydratation (recommandé par TipTap).
    immediatelyRender: false,
    // La CSP refuse les `<style>` sans nonce : la feuille de base est dans `globals.css`.
    injectCSS: false,
    editorProps: { attributes },
    onUpdate: ({ editor: updated }) => {
      setMarkdown(updated.getMarkdown());
    },
  });
  // L'éditeur est créé une fois : ses attributs (erreur, compteur) suivent par `setOptions`.
  useEffect(() => {
    if (editor !== null && !editor.isDestroyed) {
      editor.setOptions({
        editorProps: {
          attributes: editorAttributes({ id, labelId, describedBy, invalid, height }),
        },
      });
    }
  }, [editor, id, labelId, describedBy, invalid, height]);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span id={labelId} className={labelClassName}>
        {label}
      </span>
      <input type="hidden" name={name} value={markdown} />
      <div
        className={cn(
          "min-w-0 rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring",
          invalid && "border-destructive",
        )}
      >
        {editor !== null && <Toolbar editor={editor} label={label} controls={id} />}
        {editor === null ? (
          // Avant le montage de l'éditeur : même place, texte brut en lecture.
          <div className={cn("rich-text px-3 py-2 whitespace-pre-wrap", MIN_HEIGHT[height])}>
            {defaultValue}
          </div>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
      <p id={hintId} className={hintVisible ? "text-sm text-muted-foreground" : "sr-only"}>
        {hint}
      </p>
      {showCount && (
        <p
          id={countId}
          className={cn(
            "text-sm",
            tooLong ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {(tooLong ? t.tooLong : t.count)
            .replace("{count}", String(markdown.length))
            .replace("{max}", String(maxLength))}
        </p>
      )}
      {error !== null && (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
