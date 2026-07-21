import { PublicShell } from './PublicShell'

export function Privacy() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl">Privacy & safety</h1>
        <p className="mt-3 text-sm text-faint">How CRMS Connect is built to protect students.</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-ink">
          <section>
            <h2 className="text-xl">Who can be here</h2>
            <p className="mt-2 text-faint">
              Only people connected to Colorado Rocky Mountain School. Students join with a
              school email. Every adult — alum, parent, faculty, or friend of the school —
              is reviewed and approved individually by CRMS staff before their account works.
              There is no public browsing: nothing on the board is visible without an
              approved account.
            </p>
          </section>
          <section>
            <h2 className="text-xl">How contact works</h2>
            <p className="mt-2 text-faint">
              Adults cannot browse students, see a student directory, or start a conversation
              with a student. Contact begins only when a student raises a hand on an offer an
              adult has posted. The resulting conversation lives in a thread tied to that
              offer — there are no open direct messages.
            </p>
          </section>
          <section>
            <h2 className="text-xl">What staff can see</h2>
            <p className="mt-2 text-faint">
              CRMS staff can read every thread between a student and an adult, and every
              action they take is recorded in an audit log. Anyone can flag a person, offer,
              or message for staff review with one click; flags go only to staff.
            </p>
          </section>
          <section>
            <h2 className="text-xl">What we don't show</h2>
            <p className="mt-2 text-faint">
              Email addresses and phone numbers are never displayed anywhere in the app —
              not on profiles, not in threads. Student profiles are visible only to approved,
              active community members, and contain only what the student chooses to write.
            </p>
          </section>
          <section>
            <h2 className="text-xl">Data</h2>
            <p className="mt-2 text-faint">
              Accounts, offers, and threads are stored with Supabase (Postgres) with
              row-level security enforcing all of the rules above at the database layer,
              not just in the interface. Questions or removal requests: contact the CRMS
              front office and ask for the Connect administrator.
            </p>
          </section>
        </div>
      </div>
    </PublicShell>
  )
}
