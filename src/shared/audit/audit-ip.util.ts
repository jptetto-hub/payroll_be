export function normalizeAuditIpAddress(ipAddress?: string) {
  if (!ipAddress) return undefined;

  const firstIp = ipAddress.split(",")[0]?.trim();

  if (!firstIp || firstIp === "::1") {
    return "127.0.0.1";
  }

  if (firstIp.startsWith("::ffff:")) {
    return firstIp.replace("::ffff:", "");
  }

  return firstIp;
}
