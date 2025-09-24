"use client";
import React from "react";
import { ArrowRight, BarChart2, Clock, Coins, DollarSign, Globe, Layers, Lock, Mail, Menu, ShieldCheck, Smartphone, Star, TrendingUp, Users } from "lucide-react";

/**
 * Drop this component into `app/page.tsx` in a Next.js (App Router) project
 * with Tailwind configured. Assets are placeholder-only; swap with your own.
 */
export default function StenaLikeLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/60 to-white text-slate-800">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b border-slate-200/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-sm bg-sky-600" />
              <span className="font-semibold">Stena</span>
            </div>

            <nav className="hidden md:flex items-center gap-8 text-sm">
              <a className="hover:text-sky-600" href="#">Home</a>
              <a className="hover:text-sky-600" href="#markets">Markets</a>
              <a className="hover:text-sky-600" href="#company">Company</a>
              <a className="hover:text-sky-600" href="#education">Education</a>
              <a className="hover:text-sky-600" href="#resources">Resources</a>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white">
                <Mail size={16} /> Live chat
              </button>
              <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white">
                Partnership
              </button>
              <button className="text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-white">
                Login
              </button>
              <button className="text-sm px-4 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700">
                Open an Account
              </button>
            </div>

            <button className="md:hidden p-2 rounded-lg border border-slate-300">
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-sky-600 font-semibold">Home</p>
            <h1 className="mt-4 text-4xl/tight sm:text-5xl/tight font-extrabold tracking-tight text-slate-900">
              Everyone’s an Investor
            </h1>
            <p className="mt-5 max-w-xl text-slate-600">
              Get an easy-to-use platform, expert trade ideas and friendly support as standard.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button className="rounded-xl bg-sky-600 px-6 py-3 text-white hover:bg-sky-700">Open an Account</button>
              <button className="rounded-xl border border-slate-300 px-6 py-3 hover:bg-white inline-flex items-center gap-2">
                Try demo Account <ArrowRight size={16} />
              </button>
            </div>

            <div className="mt-8">
              <p className="text-sm text-slate-500">Fast and easy Deposit with:</p>
              <div className="mt-3 flex items-center gap-4 opacity-80">
                {['visa','mastercard','paypal','skrill','neteller'].map((p) => (
                  <div key={p} className="h-7 w-16 rounded-md bg-slate-200" />
                ))}
              </div>
            </div>
          </div>

          {/* Right visual */}
          <div className="relative">
            <div className="absolute -right-10 -top-10 h-60 w-60 rounded-full bg-sky-200/50 blur-3xl" />
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="absolute inset-0 grid grid-cols-2 gap-2 p-4">
                <div className="rounded-md bg-slate-50 border p-2">
                  <div className="h-6 w-24 rounded bg-slate-200" />
                  <div className="mt-2 h-32 rounded bg-slate-100" />
                </div>
                <div className="rounded-md bg-slate-50 border p-2">
                  <div className="h-6 w-24 rounded bg-slate-200" />
                  <div className="mt-2 h-32 rounded bg-slate-100" />
                </div>
                <div className="col-span-2 rounded-md bg-slate-50 border p-2">
                  <div className="h-40 rounded bg-slate-100" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats ribbon */}
        <div className="bg-slate-900 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
            <Stat icon={<Users />} label="Trusted clients" value="50K+" />
            <Stat icon={<Layers />} label="Assets management" value="75M+" />
            <Stat icon={<DiceIcon />} label="Trading instruments" value="280+" />
            <Stat icon={<Clock />} label="Executions speed" value="~30ms" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="company" className="relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 grid lg:grid-cols-2 gap-12">
          <div>
            <p className="text-sky-600 font-semibold">ACHIEVE MORE</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Purpose of a convoy is to keep your team</h2>
            <div className="mt-10 grid sm:grid-cols-2 gap-6">
              <FeatureCard icon={<BarChart2 />} title="Built for impact" desc="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt." />
              <FeatureCard icon={<RefreshIcon />} title="In sync with you" desc="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt." />
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-slate-500">FULLY REGULATED</h3>
            <h2 className="text-3xl font-bold">Trusted for more than 25 years</h2>
            <p className="text-slate-600">Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <AwardBadge title="Best CFD Broker" subtitle="TradeON Summit 2020" />
              <AwardBadge title="Best Execution Broker" subtitle="Forex EXPO Dubai 2020" />
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1600&auto=format&fit=crop" alt="Tower" className="h-72 w-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="bg-slate-50/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl font-bold text-slate-900">Begin investing in three steps</h2>
          <div className="mt-8 grid lg:grid-cols-2 gap-10 items-center">
            <div className="grid gap-4">
              <StepCard icon={<ShieldCheck />} title="Register" desc="Choose an account type and submit your application." />
              <StepCard icon={<DollarSign />} title="Fund" desc="Fund your account using a wide range of funding methods." />
              <StepCard icon={<TrendingUp />} title="Invest" desc="Access 280+ instruments across all asset classes on App." />
            </div>
            <div className="relative mx-auto w-full max-w-xl">
              <DeviceMockup />
            </div>
          </div>
        </div>
      </section>

      {/* News & Rates */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl font-bold text-slate-900">Follow the latest news!</h2>
          <div className="mt-8 grid lg:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-slate-200 p-4">
              <NewsItem title="BlackRock responds to George Soros’ criticism over China investments" time="1 hours ago" />
              <NewsItem title="Bitcoin ‘whales’ jump back into market during cryptocurrency’s rebound to $50,000" time="6 hours ago" />
              <NewsItem title="European markets head for lower open ahead of European Central Bank meeting" time="8 hours ago" />
              <div className="pt-2">
                <a className="inline-flex items-center gap-2 text-sky-600 font-medium" href="#">See more news <ArrowRight size={16} /></a>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <RatesTable />
            </div>
          </div>

          {/* Stocks + Trustpilot row */}
          <div className="mt-10 grid md:grid-cols-3 gap-4 items-center">
            <StockCard name="Alphabet" value="2,277.84" change="0.11%" up />
            <StockCard name="Microsoft" value="272.42" change="0.20%" up />
            <StockCard name="AMD" value="101.22" change="0.63%" up={false} />
          </div>

          <div className="mt-6 flex items-center gap-4">
            <p className="text-slate-600">Our customers say</p>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-current text-emerald-500" />
              ))}
            </div>
            <p className="text-slate-600">4.5 out of 5 based on 3,131 reviews</p>
            <span className="rounded-md border border-slate-300 px-2 py-1 text-xs">Trustpilot</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-sm bg-sky-600" />
              <span className="font-semibold">Stena</span>
            </div>
            <div className="flex items-center gap-4 text-slate-600">
              <a href="#" aria-label="facebook" className="hover:text-slate-900">f</a>
              <a href="#" aria-label="twitter" className="hover:text-slate-900">t</a>
              <a href="#" aria-label="instagram" className="hover:text-slate-900">ig</a>
              <a href="#" aria-label="youtube" className="hover:text-slate-900">yt</a>
            </div>
          </div>
          <div className="mt-8 grid sm:grid-cols-2 gap-6 text-sm text-slate-600">
            <div className="space-y-2">
              <p className="font-semibold text-slate-900">Contact us</p>
              <p>call +12 34 5678 5678 · <a className="text-sky-600" href="mailto:support@stena-invest.id">support@stena-invest.id</a></p>
            </div>
            <div className="flex flex-wrap gap-6">
              <a className="hover:text-slate-900" href="#">Security Center</a>
              <a className="hover:text-slate-900" href="#">Privacy Notice</a>
              <a className="hover:text-slate-900" href="#">Data Protection</a>
              <a className="hover:text-slate-900" href="#">Cookies Policy</a>
              <a className="hover:text-slate-900" href="#">Accessibility Statement</a>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold flex items-center gap-2"><ShieldCheck className="text-amber-600" /> Risk warning</p>
            <p className="mt-2">Financial spread trading comes with a high risk of losing money rapidly due to leverage. 83.5% of retail investor accounts lose money when trading CFDs with this provider.</p>
            <p className="mt-2">The content of this website must not be construed as personal advice. We recommend that you seek advice from an independent financial advisor.</p>
            <p className="mt-4 text-slate-500">©2025 Stena Invest Ltd. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
        <div className="h-6 w-6">{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-slate-300">{label}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5 shadow-sm bg-white">
      <div className="flex items-center gap-3 text-sky-700">
        <div className="rounded-xl bg-sky-50 p-2 border border-sky-100">{icon}</div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>
      <p className="mt-3 text-sm text-slate-600">{desc}</p>
      <button className="mt-4 inline-flex items-center gap-2 text-sky-600">Learn more <ArrowRight size={16} /></button>
    </div>
  );
}

function AwardBadge({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
      <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center"><Star className="text-yellow-600" /></div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function StepCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-sky-50 p-2 border border-sky-100">{icon}</div>
        <h4 className="font-semibold">{title}</h4>
      </div>
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
    </div>
  );
}

function DeviceMockup() {
  return (
    <div className="relative">
      <div className="mx-auto aspect-[16/10] w-full rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="p-4 grid grid-cols-3 gap-2">
          <div className="col-span-2 rounded-md bg-slate-50 h-40" />
          <div className="rounded-md bg-slate-50 h-40" />
          <div className="col-span-3 rounded-md bg-slate-50 h-24" />
        </div>
      </div>
      <div className="absolute -bottom-6 right-6 w-24 rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="h-40 rounded-2xl bg-slate-50" />
      </div>
    </div>
  );
}

function RatesTable() {
  const rows = [
    { pair: "EURUSD", price: "1.18013", change: "-0.12%", sub: "-0.00" },
    { pair: "GBPUSD", price: "1.35117", change: "-0.09%", sub: "-0.00" },
    { pair: "USDJPY", price: "147.782", change: "+0.10%", sub: "+0.14" },
    { pair: "USDCHF", price: "0.79203", change: "+0.13%", sub: "+0.00" },
    { pair: "AUDUSD", price: "0.65930", change: "-0.07%", sub: "-0.00" },
    { pair: "USDCAD", price: "1.38464", change: "+0.09%", sub: "+0.00" },
  ];
  return (
    <div>
      {rows.map((r) => (
        <div key={r.pair} className="grid grid-cols-4 items-center gap-4 py-3 border-b last:border-0">
          <div className="flex items-center gap-2 text-slate-700"><Globe size={16} /> {r.pair}</div>
          <div className="text-right font-medium">{r.price}</div>
          <div className={`text-right text-sm ${r.change.startsWith("-") ? "text-rose-600" : "text-emerald-600"}`}>{r.change}</div>
          <div className={`text-right text-xs ${r.sub.startsWith("-") ? "text-rose-600" : "text-emerald-600"}`}>{r.sub}</div>
        </div>
      ))}
    </div>
  );
}

function StockCard({ name, value, change, up = true }: { name: string; value: string; change: string; up?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-lg bg-slate-200" />
        <p className="font-semibold">{name}</p>
      </div>
      <div className="flex items-center gap-3">
        <p className="font-medium">{value}</p>
        <span className={`text-xs ${up ? "text-emerald-600" : "text-rose-600"}`}>{change}</span>
      </div>
    </div>
  );
}

function NewsItem({ title, time }: { title: string; time: string }) {
  return (
    <div className="flex items-start gap-3 border-b last:border-0 py-4">
      <div className="h-16 w-24 rounded-md bg-slate-200" />
      <div>
        <p className="font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-1">{time}</p>
      </div>
    </div>
  );
}

function DiceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><circle cx="7" cy="7" r="1.5"/><circle cx="17" cy="7" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/><rect x="2" y="2" width="20" height="20" rx="4" ry="4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12a9 9 0 1 1-3.1-6.8"/><polyline points="21 3 21 9 15 9"/></svg>
  );
}
