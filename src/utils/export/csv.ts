export const generateCSV = (data: any[], headers: string[]) => {
  const rows = data.map((item) =>
    headers.map((key) => `"${item[key] ?? ""}"`).join(","),
  );

  return [headers.join(","), ...rows].join("\n");
};
