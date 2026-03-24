"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-dvh relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-accent-darkred/6 blur-[150px] pointer-events-none" />

      <div className="min-h-dvh flex flex-col lg:flex-row">
        {/* ─── Left: Hero + Actions ────────────────── */}
        <div className="flex-shrink-0 lg:w-[420px] xl:w-[480px] flex flex-col items-center justify-center px-8 py-16 lg:py-0 lg:sticky lg:top-0 lg:h-dvh">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center w-full max-w-sm"
          >
            <div className="w-16 h-px bg-accent-red mx-auto mb-8" />

            <h1 className="text-5xl sm:text-6xl font-black tracking-tight uppercase mb-2">
              <span className="text-accent-red">City</span>
              <span className="text-white">Sleeps</span>
            </h1>
            <p className="text-muted-light text-sm uppercase tracking-[0.25em] mb-14">
              The Social Deduction Game
            </p>

            <div className="flex flex-col gap-3">
              <Link href="/host">
                <motion.button whileTap={{ scale: 0.98 }}
                  className="w-full py-4 px-8 bg-accent-red hover:bg-accent-crimson text-white text-sm font-bold uppercase tracking-widest rounded-lg transition-colors">
                  Host a Game
                </motion.button>
              </Link>
              <Link href="/play">
                <motion.button whileTap={{ scale: 0.98 }}
                  className="w-full py-4 px-8 bg-bg-elevated hover:bg-bg-hover text-white/80 text-sm font-bold uppercase tracking-widest rounded-lg transition-colors border border-white/10">
                  Join a Game
                </motion.button>
              </Link>
            </div>

            <div className="w-16 h-px bg-white/10 mx-auto mt-10 mb-4" />
            <p className="text-muted text-xs uppercase tracking-widest">
              One device hosts &middot; Everyone plays
            </p>
          </motion.div>
        </div>

        {/* ─── Right: Rules (always visible) ───────── */}
        <div className="flex-1 border-l border-white/[0.06] bg-bg-card/30 overflow-y-auto">
          <div className="max-w-xl mx-auto px-8 py-12 lg:py-16">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <h2 className="text-lg font-black uppercase tracking-[0.2em] text-white mb-10">
                How to Play
              </h2>

              <Section title="The Game">
                <p>
                  Mafia is a social deduction game. Players are secretly assigned roles —
                  most are innocent <strong>Civilians</strong>, but hidden among them are{" "}
                  <strong>Mafia</strong> members trying to eliminate everyone.
                </p>
                <p>
                  The game alternates between <strong>Night</strong> (Mafia acts in secret) and{" "}
                  <strong>Day</strong> (everyone debates and votes). The city wins by eliminating
                  all Mafia. The Mafia wins by outnumbering the city.
                </p>
              </Section>

              <Section title="Setup">
                <ol className="list-decimal list-inside space-y-2">
                  <li>One person opens this app on a laptop/tablet — this is the <strong>Host</strong></li>
                  <li>A room code and QR code appear on screen</li>
                  <li>Other players scan the QR code or enter the code on their phones</li>
                  <li>Host starts the game once everyone has joined</li>
                  <li>Roles are secretly dealt to each phone</li>
                </ol>
              </Section>

              <Section title="Roles">
                <div className="space-y-3">
                  <RoleCard name="Mafia" symbol="M" color="#C41E3A" team="Mafia Team"
                    desc="The killers. Each night, all Mafia members secretly choose one player to eliminate. During the day, they must blend in. Mafia members know each other." />
                  <RoleCard name="Terrorist" symbol="T" color="#E85D04" team="Mafia Team"
                    desc="Aligned with the Mafia but does not wake at night. A sleeper agent. If the Terrorist is voted out during the day, they take one random civilian down with them." />
                  <RoleCard name="Healer" symbol="H" color="#2D8B46" team="City Team"
                    desc="Each night, choose one player to protect. If the Mafia targets that player, they survive. Cannot save the same person two nights in a row." />
                  <RoleCard name="Detective" symbol="?" color="#2563EB" team="City Team"
                    desc="Each night, investigate one player. Learn if they are aligned with the Mafia or not. Be careful — revealing yourself makes you a target." />
                  <RoleCard name="Spy" symbol="S" color="#7C3AED" team="City Team"
                    desc="Wakes with the Mafia at night — sees their identities and who they target. But appears as Mafia to the Detective. Use your intel carefully without revealing yourself." />
                  <RoleCard name="Civilian" symbol="C" color="#9CA3AF" team="City Team"
                    desc="No special ability. Your power is your voice and your vote. Pay attention, ask questions, and figure out who the Mafia is." />
                </div>
              </Section>

              <Section title="Game Flow">
                <div className="space-y-5">
                  <Phase num="1" title="Night Phase" lines={[
                    "The host device announces \"Night falls\" — everyone closes their eyes",
                    "Mafia and Spy open their eyes — the Spy sees who the Mafia targets but cannot act",
                    "The Healer picks someone to protect",
                    "The Detective picks someone to investigate",
                  ]} />
                  <Phase num="2" title="Dawn" lines={[
                    "The host announces what happened overnight",
                    "If someone was killed, they are eliminated",
                    "If the Healer saved the target, no one dies",
                  ]} />
                  <Phase num="3" title="Discussion" lines={[
                    "Everyone debates who they think is Mafia",
                    "Make accusations, defend yourself, share clues",
                    "The host device runs a countdown timer",
                  ]} />
                  <Phase num="4" title="Vote" lines={[
                    "Everyone votes on their phone for who to eliminate",
                    "Majority required — ties mean no elimination",
                    "If a Terrorist is voted out, they take someone with them",
                  ]} />
                  <Phase num="5" title="Repeat" lines={[
                    "Night falls again and the cycle continues",
                    "The game ends when one side wins",
                  ]} />
                </div>
              </Section>

              <Section title="Win Conditions">
                <div className="space-y-3">
                  <div className="bg-bg-primary border border-white/5 rounded-lg p-4">
                    <p className="text-sm font-bold uppercase tracking-wider text-white mb-1">Civilians Win</p>
                    <p className="text-muted-light text-xs">All Mafia-aligned players (Mafia + Terrorist) are eliminated.</p>
                  </div>
                  <div className="bg-bg-primary border border-accent-red/20 rounded-lg p-4">
                    <p className="text-sm font-bold uppercase tracking-wider text-accent-red mb-1">Mafia Wins</p>
                    <p className="text-muted-light text-xs">Mafia-aligned players equal or outnumber the remaining civilians.</p>
                  </div>
                </div>
              </Section>

              <Section title="Role Distribution">
                <div className="bg-bg-primary border border-white/5 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-muted uppercase tracking-wider">
                        <th className="text-left p-3">Players</th>
                        <th className="text-center p-2">M</th>
                        <th className="text-center p-2">T</th>
                        <th className="text-center p-2">H</th>
                        <th className="text-center p-2">D</th>
                        <th className="text-center p-2">S</th>
                        <th className="text-center p-2">C</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-light">
                      <DistRow p="4–5" m={1} t={0} d={1} det={1} spy={0} v="1–2" />
                      <DistRow p="6–7" m={1} t={1} d={1} det={1} spy={0} v="2–3" />
                      <DistRow p="8–9" m={2} t={1} d={1} det={1} spy={1} v="2–3" />
                      <DistRow p="10–12" m={2} t={1} d={1} det={1} spy={1} v="4–6" />
                      <DistRow p="13–15" m={3} t={1} d={1} det={1} spy={1} v="6–8" />
                    </tbody>
                  </table>
                </div>
                <p className="text-muted text-[10px] mt-2 uppercase tracking-wider">
                  M = Mafia &middot; T = Terrorist &middot; H = Healer &middot; D = Detective &middot; S = Spy &middot; C = Civilian
                </p>
              </Section>

              <Section title="Tips">
                <ul className="space-y-2 text-muted-light text-xs">
                  <Tip>Keep the host device visible and volume up — it narrates the game aloud</Tip>
                  <Tip>Never show your phone screen to anyone</Tip>
                  <Tip>Dead players must stay completely silent — no hints allowed</Tip>
                  <Tip>As Detective, be careful about revealing your findings — the Mafia will target you</Tip>
                  <Tip>As Spy, cross-reference your intel with the Detective to narrow down suspects</Tip>
                  <Tip>As Mafia, act normal. Accuse others. Create doubt and chaos.</Tip>
                  <Tip>Voting out a Terrorist is risky — they take an innocent player down with them</Tip>
                  <Tip>Minimum 4 players. Best with 8–12.</Tip>
                </ul>
              </Section>
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-6 h-px bg-accent-red" />
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">{title}</h3>
      </div>
      <div className="text-muted-light text-xs leading-relaxed space-y-2.5 pl-[18px]">{children}</div>
    </div>
  );
}

function RoleCard({ name, symbol, color, team, desc }: { name: string; symbol: string; color: string; team: string; desc: string }) {
  return (
    <div className="bg-bg-primary rounded-lg p-4 border" style={{ borderColor: `${color}20` }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-black" style={{ backgroundColor: `${color}15`, color }}>
          {symbol}
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{name}</span>
          <span className="text-muted text-[10px] ml-2 uppercase tracking-wider">{team}</span>
        </div>
      </div>
      <p className="text-muted-light text-[11px] leading-relaxed">{desc}</p>
    </div>
  );
}

function Phase({ num, title, lines }: { num: string; title: string; lines: string[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-5 h-5 rounded bg-accent-red/15 text-accent-red text-[10px] font-black flex items-center justify-center">{num}</span>
        <span className="text-xs font-bold uppercase tracking-wider text-white">{title}</span>
      </div>
      <ul className="space-y-1 pl-7">
        {lines.map((line, i) => (
          <li key={i} className="text-muted-light text-[11px] leading-relaxed flex gap-2">
            <span className="text-muted shrink-0">&#8250;</span>{line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DistRow({ p, m, t, d, det, spy, v }: { p: string; m: number; t: number; d: number; det: number; spy: number; v: string }) {
  return (
    <tr className="border-b border-white/[0.03]">
      <td className="p-3 font-medium text-white">{p}</td>
      <td className="p-2 text-center text-accent-red font-bold">{m}</td>
      <td className="p-2 text-center text-orange-400 font-bold">{t || <span className="text-muted">—</span>}</td>
      <td className="p-2 text-center text-green-500 font-bold">{d}</td>
      <td className="p-2 text-center text-blue-400 font-bold">{det}</td>
      <td className="p-2 text-center text-purple-400 font-bold">{spy || <span className="text-muted">—</span>}</td>
      <td className="p-2 text-center">{v}</td>
    </tr>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-accent-red font-bold shrink-0">&mdash;</span>
      {children}
    </li>
  );
}
