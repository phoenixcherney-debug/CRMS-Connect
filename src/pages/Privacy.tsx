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
      <ul className="list-disc pl-6 space-y-1.5">
        <li>Your name, role, and bio are visible to other authenticated members.</li>
        <li>Your email is visible only to you, school administrators, and an employer whose offer you accept.</li>
        <li>Direct messages are visible only to the two participants and school administrators.</li>
      </ul>

      <h2 className="text-lg font-semibold text-ink">Your choices</h2>
      <p>
        You can edit or remove most profile fields at any time on your{' '}
        <a className="text-primary hover:text-primary-light underline" href="/profile">profile</a>.
        To delete your account, email{' '}
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
