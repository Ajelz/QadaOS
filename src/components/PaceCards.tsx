import { Card, CardTitle } from "@/components/ui/Card";
import type { Finish, Pace } from "@/domain/strategy";
import { fmtMonth, fmtRelativeDays } from "@/lib/format";

/**
 * Two projections, stated as plain facts. No red, no "you are failing": when there is no
 * date yet the card says what would produce one. A far-off date always carries its daily
 * number, because "5 a day" is something a person can act on and "17 years" is not.
 */
export function PaceCards({ planFinish, hasPlan, perDay, pace, historyDays }: { planFinish?: Finish; hasPlan: boolean; perDay?: number; pace: Pace; historyDays: number }) {
  const net = Math.abs(pace.netPerDay) < 0.05 ? 0 : pace.netPerDay;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <CardTitle>On plan</CardTitle>
        {planFinish ? (
          <>
            <div className="display num mt-1.5 whitespace-nowrap text-[20px] min-[360px]:text-[28px]">{planFinish.days === 0 ? "Clear" : fmtMonth(planFinish.finishDay)}</div>
            <p className="mt-1 text-[13px] font-semibold text-mute">{planFinish.days === 0 ? "Nothing owed." : `${perDay ? `At ${perDay} a day, ` : ""}about ${fmtRelativeDays(planFinish.days)}. Raise the daily number to bring it closer.`}</p>
          </>
        ) : hasPlan && perDay ? (
          // The plan does make progress, just not within the hundred years the projection looks ahead.
          <>
            <div className="mt-1.5 text-[17px] font-black text-mute">100+ years</div>
            <p className="mt-1 text-[13px] font-semibold text-mute">At {perDay} a day this runs past a century. Raise the daily number to bring it within reach.</p>
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
        {historyDays < 7 ? (
          <>
            <div className="mt-1.5 text-[17px] font-black text-mute">Too early</div>
            <p className="mt-1 text-[13px] font-semibold text-mute">Your own pace appears after about a week of entries.</p>
          </>
        ) : pace.finishDay ? (
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
