import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await auth()
  if (session) redirect("/dashboard")

  return (
    <main className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">V</span>
          </div>
          <span className="font-bold text-gray-900">VerifyChain Africa</span>
        </div>
        <a
          href="/login"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
        >
          Manufacturer Login
        </a>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span className="text-sm text-green-700 font-medium">
            Protecting consumers across Africa
          </span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight tracking-tight mb-6">
          Stop counterfeit drinks
          <br />
          <span className="text-green-600">before they cause harm</span>
        </h1>

        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          VerifyChain gives every bottle a unique digital identity.
          Consumers verify authenticity instantly via WhatsApp.
          Manufacturers get real-time fraud intelligence.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/login"
            className="rounded-xl bg-gray-900 px-8 py-3.5 text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            Get Started as a Manufacturer
          </a>
          <a
            href="#how-it-works"
            className="rounded-xl border border-gray-200 px-8 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            See How It Works
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="text-gray-500 mt-3 text-base max-w-xl mx-auto">
              Three steps. No app required. Works on every phone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: "🔍",
                title: "Open your bottle",
                description:
                  "A hidden QR code is revealed under the bottle cap when opened for the first time.",
              },
              {
                step: "02",
                icon: "📱",
                title: "Scan via WhatsApp",
                description:
                  "Scan the QR code with your phone camera or send the serial code to our WhatsApp number.",
              },
              {
                step: "03",
                icon: "✅",
                title: "Get instant result",
                description:
                  "Genuine product confirmation in seconds. If the bottle was previously opened, you are warned immediately.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
              >
                <div className="text-3xl mb-4">{item.icon}</div>
                <div className="text-xs font-mono text-gray-400 mb-2">
                  Step {item.step}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">
              Built for the African market
            </h2>
            <p className="text-gray-500 mt-3 text-base max-w-xl mx-auto">
              Designed around how people actually buy and consume beverages in Nigeria and across West Africa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: "💬",
                title: "WhatsApp-native",
                description:
                  "No app to download. Works on any phone that runs WhatsApp — which is nearly every phone in Nigeria.",
              },
              {
                icon: "🔒",
                title: "One-time verification",
                description:
                  "Each QR code can only be verified as genuine once. Refilled or reused bottles are flagged automatically.",
              },
              {
                icon: "🌍",
                title: "Geographic fraud detection",
                description:
                  "If the same bottle is scanned in Lagos and Abuja within minutes, the system flags it as impossible and alerts the manufacturer.",
              },
              {
                icon: "📊",
                title: "Real-time manufacturer dashboard",
                description:
                  "Track scan activity, view fraud alerts, generate new QR batches, and export data — all from one dashboard.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex gap-4 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm"
              >
                <div className="text-2xl shrink-0">{item.icon}</div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to protect your brand?
          </h2>
          <p className="text-gray-400 mb-8 text-base leading-relaxed">
            Join VerifyChain Africa and give your customers the confidence
            that every bottle they open is genuine.
          </p>
          <a
            href="/login"
            className="inline-block rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Get Started Free
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-900 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">V</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              VerifyChain Africa
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Protecting consumers. Protecting brands. Eliminating refill fraud.
          </p>
        </div>
      </footer>

    </main>
  )
}