/** Human phrasing for audit-log action keys ("verification.approve" → "approved"). */
const ACTION_LABEL: Record<string, string> = {
  "verification.approve": "approved",
  "verification.reject": "rejected",
  "verification.request_info": "requested info from",
  "user.suspend": "suspended",
  "user.activate": "reactivated",
  "user.delete": "deleted",
  "user.restore": "restored",
  "user.bulk_suspend": "bulk-suspended members",
  "user.bulk_activate": "bulk-activated members",
  "pricing.create": "created plan",
  "pricing.update": "updated plan",
  "pricing.delete": "deleted plan",
  "pricing.reorder": "reordered plans",
  "settings.site.update": "updated site settings",
  "settings.appearance.update": "updated appearance",
  "admin.grant": "granted admin to",
  "admin.revoke": "revoked admin from",
  "match.introduce": "introduced",
};
export function describeAction(action: string): string {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  if (action.startsWith("report.")) return `marked report ${action.slice(7).replace(/_/g, " ")}`;
  return action.replace(/[._]/g, " ");
}


export const ACTION_GROUPS: Array<{ value: string; label: string }> = [
  { value: "verification.", label: "Verifications" },
  { value: "user.", label: "Members" },
  { value: "match.", label: "Matchmaking" },
  { value: "report.", label: "Reports" },
  { value: "pricing.", label: "Pricing" },
  { value: "settings.", label: "Settings" },
  { value: "admin.", label: "Admin access" },
];
