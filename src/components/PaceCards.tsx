import { Card, CardTitle } from "@/components/ui/Card";
import type { Finish, Pace } from "@/domain/strategy";
import { fmtMonth, fmtRelativeDays } from "@/lib/format";

/**
 * Two projections, stated as plain facts. No red, no "you are failing": when there is no
 * date yet the card says what would produce one.
 */
export function PaceCards({ planFinish, hasPlan, pace }: { planFinish?: Finish; hasPlan: boolean; pace: Pace }) {
  const net = Math.abs(pace.netPerDay) < 0.05 ? 0 : pace.netPerDay;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <CardTitle>On plan</CardTitle>
        {planFinish ? (
          <>
            <div className="display num mt-1.5 whitespace-nowrap text-[20px] min-[360px]:text-[28px]">{planFinish.days === 0 ? "Clear" : fmtMonth(planFinish.finishDay)}</div>
            <p className="mt-1 text-[13px] font-semibold text-mute">{planFinish.days === 0 ? "Nothing owed." : `About ${fmtRelativeDays(planFinish.days)}, if you meet the plan every day.`}</p>
          </>
        ) : (
          <>
            <div className="mt-1.5 text-[17px] font-black text-mute">{hasPlan ? "No date" : "No plan"}</div>
            <p className="mt-1 text-[13px] font-semibold text-mute">{hasPlan ? "This plan has no targets left to work through." : "Choose a plan to see a finish date."}</p>
          </>
        )}
      </Card>
      <Card>
        <CardTitle>Your pace</CardTitle>
        {pace.finishDay ? (
          <>
            <div className="display num mt-1.5 whitespace-nowrap text-[20px] min-[360px]:text-[28px]">{pace.daysToFinish === 0 ? "Clear" : fmtMonth(pace.finishDay)}</div>
            <p className="mt-1 text-[13px] font-semibold text-mute">{pace.daysToFinish ? `About ${fmtRelativeDays(pace.daysToFinish)}, at ${net.toFixed(1)} a day net over 30 days.` : "Nothing owed."}</p>
          </>
        ) : (
          <>
            <div className="mt-1.5 text-[17px] font-black text-mute">No date yet</div>
            <p className="mt-1 text-[13px] font-semibold text-mute">A date appears once your qada outpaces missed prayers over 30 days.</p>
          </>
        )}
      </Card>
    </div>
  );
}
