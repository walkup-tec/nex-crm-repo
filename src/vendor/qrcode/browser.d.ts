declare module "@/vendor/qrcode/lib/browser.js" {
  const QRCode: {
    toDataURL: (
      text: string,
      options?: {
        width?: number;
        margin?: number;
        errorCorrectionLevel?: "L" | "M" | "Q" | "H";
        color?: { dark?: string; light?: string };
      },
    ) => Promise<string>;
  };
  export default QRCode;
}
