"use client";

import { useState } from "react";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/admin/PageShell";
import { Panel } from "@/components/admin/primitives";
import ConsentPanel from "./ConsentPanel";
import EditProfileDialog from "./EditProfileDialog";
import Member360 from "./Member360";
import MembershipPanel from "./MembershipPanel";

export { ConsentPanel, EditProfileDialog, Member360, MembershipPanel };

/**
 * Everything staff can see and do on one member beyond the CRM card:
 * membership (offline payments), Member 360, consent records, and correcting
 * profile details. Mounted once on /admin/users/[id]; `onChanged` lets the page
 * refetch its own header after a membership or profile change.
 */
export default function MemberAdminPanels({ userId, memberName, isDeleted, hasProfile, onChanged }: {
  userId: string; memberName: string; isDeleted?: boolean; hasProfile?: boolean; onChanged?: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const changed = () => { setRefreshKey((k) => k + 1); onChanged?.(); };

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <MembershipPanel userId={userId} memberName={memberName} refreshKey={refreshKey} onChanged={changed} />
      <Member360 userId={userId} refreshKey={refreshKey} />
      <ConsentPanel userId={userId} />
      <Panel
        id="member-edit"
        title="Correct profile details"
        description="Fix a typo, a wrong city or a date of birth for the member. Sensitive fields, photos and the member's own words stay theirs to change."
        actions={
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)} disabled={isDeleted || hasProfile === false}
            title={isDeleted ? "This account is deleted" : hasProfile === false ? "No profile yet" : undefined}>
            <PencilLine className="h-3.5 w-3.5" aria-hidden /> Edit details
          </Button>
        }
      >
        <p className="text-[12.5px] text-muted2-foreground">
          Each edit needs a reason, is recorded in the audit log with what changed, and (unless you untick it) the member is told.
        </p>
      </Panel>
      <EditProfileDialog userId={userId} memberName={memberName} open={editing} onClose={() => setEditing(false)} onSaved={changed} />
    </div>
  );
}
