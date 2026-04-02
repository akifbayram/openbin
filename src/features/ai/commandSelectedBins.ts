/** Module-level ref so BinListPage can communicate selected bin IDs to CommandInput without prop-drilling through AppLayout. */
let ids: string[] | undefined;

export function setCommandSelectedBinIds(v: string[] | undefined) {
  ids = v;
}

export function getCommandSelectedBinIds() {
  return ids;
}
