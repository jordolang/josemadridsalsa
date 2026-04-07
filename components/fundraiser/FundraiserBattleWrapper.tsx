"use client";

import { useState, useEffect, useRef } from "react";
import BattleArena from "./BattleArena";

interface Props {
  myTeamId: string;
  oppTeamId: string | null;
  shieldExpiresAt: string | null;
  shieldHPRemaining: number;
}

export default function FundraiserBattleWrapper({
  myTeamId, oppTeamId, shieldExpiresAt, shieldHPRemaining,
}: Props) {
  const [mySale,    setMySale]    = useState(0);
  const [oppSale,   setOppSale]   = useState(0);
  const [sharedAt,  setSharedAt]  = useState(false);
  const [shieldExp, setShieldExp] = useState(shieldExpiresAt);
  const [shieldHP,  setShieldHP]  = useState(shieldHPRemaining);
  const seqRef = useRef(0);

  // Poll for new sale events every 10 seconds
  useEffect(() => {
    const controller = new AbortController();

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/fundraiser/battle-state?myTeam=${encodeURIComponent(myTeamId)}&oppTeam=${encodeURIComponent(oppTeamId ?? "")}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.latestMySaleDollars)  { seqRef.current++; setMySale(data.latestMySaleDollars + seqRef.current * 1e-9); }
        if (data.latestOppSaleDollars) { seqRef.current++; setOppSale(data.latestOppSaleDollars + seqRef.current * 1e-9); }
        if (data.shieldExpiresAt)      setShieldExp(data.shieldExpiresAt);
        if (data.shieldHPRemaining !== undefined) setShieldHP(data.shieldHPRemaining);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    };

    poll();
    const id = setInterval(poll, 10_000);
    return () => { controller.abort(); clearInterval(id); };
  }, [myTeamId, oppTeamId]);

  return (
    <BattleArena
      incomingSaleDollars={mySale}
      opponentSaleDollars={oppSale}
      shareConfirmed={sharedAt}
      shieldExpiresAt={shieldExp}
      shieldHPRemaining={shieldHP}
    />
  );
}
