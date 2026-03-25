"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useGameTheme } from "@/lib/ThemeProvider";
import { ModeToggle } from "@/components/ModeToggle";
import { Role } from "@/engine/types";

const ROLE_ORDER: Role[] = ["MAFIA", "TERRORIST", "HEALER", "DETECTIVE", "SPY", "CIVILIAN"];

export default function Home() {
  const { theme } = useGameTheme();
  const r = theme.roles;

  return (
    <main className="min-h-dvh relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-accent-darkred/6 blur-[150px] pointer-events-none" />

      {/* Mode toggle - top center */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <ModeToggle />
      </div>

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
              <span className="text-accent-red">{theme.brand.first}</span>
              <span className="text-white">{theme.brand.second}</span>
            </h1>
            <div className="inline-block px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full mb-3">
              <span className="text-amber-400 text-[10px] font-bold uppercase tracking-widest">Beta</span>
            </div>
            <p className="text-muted-light text-sm uppercase tracking-[0.25em] mb-14">
              {theme.brand.subtitle}
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
            <p className="text-muted text-xs uppercase tracking-widest mb-6">
              One device hosts &middot; Everyone plays
            </p>
            <div className="bg-bg-card/60 border border-white/5 rounded-lg p-4">
              <p className="text-muted text-[10px] uppercase tracking-widest mb-1">Beta Version</p>
              <p className="text-muted-light text-[11px] leading-relaxed">
                This game is in beta and may have bugs. Please report issues and share feedback via WhatsApp:
              </p>
              <a
                href="https://wa.me/971509524814"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-[#25D366] text-xs font-bold hover:underline"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                +971 50 952 4814
              </a>
            </div>
          </motion.div>
        </div>

        {/* ─── Right: Rules (always visible) ───────── */}
        <div className="flex-1 border-l border-white/[0.06] bg-bg-card/30 overflow-y-auto">
          <div className="max-w-xl mx-auto px-8 py-12 lg:py-16">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-white mb-10">
                How to Play
              </h2>

              <Section title="The Game">
                <p>
                  {theme.mode === "dhurandhar" ? (
                    <>
                      Set in the streets of Lyari, this social deduction game pits <strong>India&apos;s agents</strong> against
                      hidden <strong>ISI operatives</strong>. Inspired by the movie <strong>Dhurandhar</strong>.
                    </>
                  ) : (
                    <>
                      Mafia is a social deduction game. Players are secretly assigned roles —
                      most are innocent <strong>{r.CIVILIAN.name}s</strong>, but hidden among them are{" "}
                      <strong>{r.MAFIA.name}</strong> members trying to eliminate everyone.
                    </>
                  )}
                </p>
                <p>
                  The game alternates between <strong>Night</strong> (
                  {theme.mode === "dhurandhar" ? "ISI acts in secret" : "Mafia acts in secret"}) and{" "}
                  <strong>Day</strong> (everyone debates and votes).{" "}
                  {theme.win.goodTitle.replace(" Win", "")} win by eliminating all{" "}
                  {theme.mode === "dhurandhar" ? "ISI operatives" : "Mafia"}.{" "}
                  {theme.teamNames.evil} wins by outnumbering {theme.teamNames.good.toLowerCase()}.
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
                  {ROLE_ORDER.map((role) => (
                    <RoleCard
                      key={role}
                      name={r[role].name}
                      symbol={r[role].symbol}
                      color={r[role].color}
                      team={role === "MAFIA" || role === "TERRORIST" ? theme.teamNames.evil : theme.teamNames.good}
                      desc={r[role].description}
                    />
                  ))}
                </div>
              </Section>

              <Section title="Game Flow">
                <div className="space-y-5">
                  <Phase num="1" title="Night Phase" lines={[
                    `The host device announces "Night falls" — everyone closes their eyes`,
                    `${r.MAFIA.name} and ${r.SPY.name} open their eyes — ${r.SPY.name} sees who ${r.MAFIA.name} targets but cannot act`,
                    `${r.HEALER.name} picks someone to protect`,
                    `${r.DETECTIVE.name} picks someone to investigate`,
                  ]} />
                  <Phase num="2" title="Dawn" lines={[
                    "The host announces what happened overnight",
                    "If someone was killed, they are eliminated",
                    `If ${r.HEALER.name} saved the target, no one dies`,
                  ]} />
                  <Phase num="3" title="Discussion" lines={[
                    `Everyone debates who they think is ${r.MAFIA.name}`,
                    "Make accusations, defend yourself, share clues",
                    "The host device runs a countdown timer",
                  ]} />
                  <Phase num="4" title="Vote" lines={[
                    "Everyone votes on their phone for who to eliminate",
                    "Majority required — ties mean no elimination",
                    `If ${r.TERRORIST.name} is voted out, they take someone with them`,
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
                    <p className="text-sm font-bold uppercase tracking-wider text-white mb-1">{theme.win.goodTitle}</p>
                    <p className="text-muted-light text-xs">{theme.win.goodDesc}</p>
                  </div>
                  <div className="bg-bg-primary border border-accent-red/20 rounded-lg p-4">
                    <p className="text-sm font-bold uppercase tracking-wider text-accent-red mb-1">{theme.win.evilTitle}</p>
                    <p className="text-muted-light text-xs">{theme.win.evilDesc}</p>
                  </div>
                </div>
              </Section>

              <Section title="Role Distribution">
                <div className="bg-bg-primary border border-white/5 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-muted uppercase tracking-wider">
                        <th className="text-left p-3">Players</th>
                        <th className="text-center p-2">{r.MAFIA.symbol}</th>
                        <th className="text-center p-2">{r.TERRORIST.symbol}</th>
                        <th className="text-center p-2">{r.HEALER.symbol}</th>
                        <th className="text-center p-2">{r.DETECTIVE.symbol}</th>
                        <th className="text-center p-2">{r.SPY.symbol}</th>
                        <th className="text-center p-2">{r.CIVILIAN.symbol}</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-light">
                      <DistRow r={r} p="4-5" m={1} t={0} h={1} d={1} s={0} c="1-2" />
                      <DistRow r={r} p="6-7" m={1} t={1} h={1} d={1} s={0} c="2-3" />
                      <DistRow r={r} p="8-9" m={2} t={1} h={1} d={1} s={1} c="2-3" />
                      <DistRow r={r} p="10-12" m={2} t={1} h={1} d={1} s={1} c="4-6" />
                      <DistRow r={r} p="13-15" m={3} t={1} h={1} d={1} s={1} c="6-8" />
                    </tbody>
                  </table>
                </div>
                <p className="text-muted text-[10px] mt-2 uppercase tracking-wider">
                  {theme.legend}
                </p>
              </Section>

              <Section title="Tips">
                <ul className="space-y-2 text-muted-light text-xs">
                  <Tip>Keep the host device visible and volume up — it narrates the game aloud</Tip>
                  <Tip>Never show your phone screen to anyone</Tip>
                  <Tip>Dead players must stay completely silent — no hints allowed</Tip>
                  <Tip>As {r.DETECTIVE.name}, be careful about revealing your findings — {r.MAFIA.name} will target you</Tip>
                  <Tip>As {r.SPY.name}, cross-reference your intel with {r.DETECTIVE.name} to narrow down suspects</Tip>
                  <Tip>As {r.MAFIA.name}, act normal. Accuse others. Create doubt and chaos.</Tip>
                  <Tip>Voting out {r.TERRORIST.name} is risky — they take an innocent player down with them</Tip>
                  <Tip>Minimum 4 players. Best with 8-12.</Tip>
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

function DistRow({ r: roles, p, m, t, h, d, s, c }: {
  r: Record<Role, { color: string; symbol: string; name: string; team: string; description: string }>;
  p: string; m: number; t: number; h: number; d: number; s: number; c: string;
}) {
  return (
    <tr className="border-b border-white/[0.03]">
      <td className="p-3 font-medium text-white">{p}</td>
      <td className="p-2 text-center font-bold" style={{ color: roles.MAFIA.color }}>{m}</td>
      <td className="p-2 text-center font-bold" style={{ color: roles.TERRORIST.color }}>{t || <span className="text-muted">—</span>}</td>
      <td className="p-2 text-center font-bold" style={{ color: roles.HEALER.color }}>{h}</td>
      <td className="p-2 text-center font-bold" style={{ color: roles.DETECTIVE.color }}>{d}</td>
      <td className="p-2 text-center font-bold" style={{ color: roles.SPY.color }}>{s || <span className="text-muted">—</span>}</td>
      <td className="p-2 text-center">{c}</td>
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
