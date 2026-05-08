import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div className="max-w-2xl mx-auto py-6">
      <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
        About CRMS Connect
      </h1>
      <p className="text-ink-secondary mt-3 leading-relaxed">
        CRMS Connect is a private platform for Colorado Rocky Mountain School
        students and partner employers and mentors. It exists to help
        students find internships, mentors, and post-graduation opportunities
        through the school's network.
      </p>
      <p className="text-ink-secondary mt-3 leading-relaxed">
        Use of CRMS Connect is restricted to verified members of the CRMS
        community. Student accounts require a <code>@crms.org</code> email.
        Employer and mentor accounts are added by school staff or self-
        register; questions about account access go to the registrar.
      </p>
      <h2 className="text-lg font-semibold text-ink mt-6 mb-2">Questions?</h2>
      <p className="text-ink-secondary leading-relaxed">
        Email{' '}
        <a className="text-primary hover:text-primary-light underline" href="mailto:registrar@crms.org?subject=CRMS%20Connect">
          registrar@crms.org
        </a>{' '}or read our{' '}
        <Link to="/privacy" className="text-primary hover:text-primary-light underline">
          privacy policy
        </Link>.
      </p>
    </div>
  )
}
