declare const QRCode: {
  create: (
    data: string,
    options?: { errorCorrectionLevel?: string },
  ) => { modules: { size: number; get: (row: number, col: number) => number } };
};

export default QRCode;
