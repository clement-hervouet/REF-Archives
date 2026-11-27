import { describe, expect, it, vi } from "vitest";
import { MAX_LOGO_BYTES, createFetchLogo, sniffImage, toLogoImage } from "./ffbb-logos";

const UUID = "02175814-01ac-441c-a86a-2f4a9b80b1e0";
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

function image(bytes: Uint8Array<ArrayBuffer>, type: string, status = 200): Response {
  return new Response(bytes, { status, headers: { "Content-Type": type } });
}

describe("sniffImage", () => {
  it("reconnaît WebP, PNG et JPEG à leurs octets", () => {
    expect(sniffImage(WEBP)).toBe("image/webp");
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(JPEG)).toBe("image/jpeg");
  });

  it("refuse le SVG et le reste", () => {
    expect(sniffImage(SVG)).toBeNull();
    expect(sniffImage(new Uint8Array([]))).toBeNull();
  });
});

describe("toLogoImage", () => {
  it("garde une image dont le type déclaré correspond aux octets", async () => {
    expect(await toLogoImage(image(WEBP, "image/webp"))).toEqual({
      mime: "image/webp",
      bytes: WEBP,
    });
  });

  it("refuse un type déclaré qui ne correspond pas, un SVG ou une erreur HTTP", async () => {
    expect(await toLogoImage(image(PNG, "image/webp"))).toBeNull();
    expect(await toLogoImage(image(SVG, "image/svg+xml"))).toBeNull();
    expect(await toLogoImage(image(WEBP, "image/webp", 403))).toBeNull();
  });

  it("refuse une image trop lourde", async () => {
    const big = new Uint8Array(MAX_LOGO_BYTES + 1);
    big.set(PNG);
    expect(await toLogoImage(image(big, "image/png"))).toBeNull();
  });
});

describe("createFetchLogo", () => {
  it("demande un WebP de 256 px au CDN de la FFBB, sans suivre de redirection", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(image(WEBP, "image/webp"));
    expect(await createFetchLogo(fetchImpl)(UUID)).toEqual({ mime: "image/webp", bytes: WEBP });
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://api.ffbb.com/assets/${UUID}?height=256&format=webp`,
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("n'appelle rien pour un UUID mal formé", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await createFetchLogo(fetchImpl)("../../etc/passwd")).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rend null en cas de panne réseau", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    expect(await createFetchLogo(fetchImpl)(UUID)).toBeNull();
  });
});
