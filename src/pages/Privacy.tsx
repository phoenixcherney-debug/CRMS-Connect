export default function Privacy() {
  return (
    <div className="max-w-2xl mx-auto py-6 text-ink-secondary leading-relaxed space-y-4">
      <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
        Privacy
      </h1>
      <p>
        CRMS Connect is operated for Colorado Rocky Mountain School. The school
        is the data controller for personal information collected through this
        platform. This page explains, in plain language, what we collect and
        why.
      </p>

      <h2 className="text-lg font-semibold text-ink">What we collect</h2>
      <ul className="list-disc pl-6 space-y-1.5">
        <li>Account info you provide on signup: name, role, email, password.</li>
        <li>Profile info you choose to add: bio, grade, graduation year, interests, weekly availability, photo.</li>
        <li>Content you post: opportunities, applications, messages between members.</li>
        <li>Basic technical info: IP address, browser type, login timestamps.</li>
      </ul>

      <h2 className="text-lg font-semibold text-ink">How we use it</h2>
      <ul className="list-disc pl-6 space-y-1.5">
        <li>To run the platform: showing posts, routing applications, sending messages.</li>
        <li>To prevent abuse: rate-limiting, banning accounts that violate the school's policies.</li>
        <li>We do <strong>not</strong> sell your data and we do <strong>not</strong> use it for advertising.</li>
      </ul>

      <h2 className="text-lg font-semibold text-ink">Who can see what</h2>
      <p>
        Different fields have different audiences. The table below lists the
        fields a student can fill in and who else sees them by default.
      </p>
      <ul className="list-disc pl-6 space-y-1.5">
        <li><strong>Name, role, bio, photo, weekly availability, areas of interest:</strong> visible to other authenticated members.</li>
        <li><strong>Grade (9th–12th, Gap Year):</strong> visible only to you by default. Toggle "Share grade with employers and mentors" on your <a className="text-primary hover:text-primary-light underline" href="/profile">profile</a> to opt in.</li>
        <li><strong>Expected graduation year:</strong> visible to other authenticated members.</li>
        <li><strong>Email address:</strong> visible only to you, school administrators, and an employer whose offer you accept.</li>
        <li><strong>Resume / portfolio link on an application:</strong> visible only to the employer whose opportunity you applied to and to school administrators.</li>
        <li><strong>Direct messages:</strong> visible only to the two participants and school administrators.</li>
      </ul>

      <h2 className="text-lg font-semibold text-ink">Your choices</h2>
      <p>
        You can edit or remove most profile fields at any time on your{' '}
        <a className="text-primary hover:text-primary-light underline" href="/profile">profile</a>.
      </p>
      <p>
        To delete your account, open your{' '}
        <a className="text-primary hover:text-primary-light underline" href="/profile">profile</a>{' '}
        and use the <strong>Delete my account…</strong> button. This
        permanently removes your name, bio, and other personal details, and
        hides you from the directory. Your applications and posts remain
        attributed to "Deleted user" so employers' records aren't disrupted.
        If you can't sign in, email{' '}
        <a className="text-primary hover:text-primary-light underline" href="mailto:registrar@crms.org?subject=CRMS%20Connect%20account%20deletion">
          registrar@crms.org
        </a>.
      </p>

      <p className="text-xs text-ink-muted pt-4">
        This is a plain-English summary, not a legal document. For the school's
        full privacy policy, contact the registrar.
      </p>
    </div>
  )
}
