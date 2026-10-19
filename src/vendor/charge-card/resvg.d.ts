export function initWasm(module_or_path: Promise<BufferSource> | BufferSource): Promise<void>;

export class Resvg {
  constructor(
    svg: string,
    options?: {
      font?: {
        fontBuffers: Uint8Array[];
        defaultFontFamily?: string;
        sansSerifFamily?: string;
      };
      shapeRendering?: number;
      textRendering?: number;
    },
  );
  render(): { asPng(): Uint8Array };
  free(): void;
}
