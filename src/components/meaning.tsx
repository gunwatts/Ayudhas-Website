const PHILOSOPHY = [
  { n: "01", title: "People have goals", text: "Finishing the day's work, keeping a routine, knowing where the money went." },
  { n: "02", title: "Each challenge needs its own tool", text: "A list is not a stopwatch; a stopwatch is not a calendar." },
  { n: "03", title: "Good tools make hard things simple", text: "They do one job well and stay out of the way." },
  { n: "04", title: "Ayudhas keeps them together", text: "One name, one design and one place to find each of them." },
];

/** Scene 2: from the Sanskrit word to the brand's own reading of it. */
export function Meaning() {
  return (
    <section id="meaning" className="scene meaning" aria-labelledby="meaning-title">
      <div className="wrap">
        <div className="scene-head reveal">
          <span className="label">The name</span>
          <h2 id="meaning-title">An instrument in the hand of the one who uses it.</h2>
        </div>

        <div className="meaning-track">
          <article className="glass meaning-card reveal">
            <span className="label">The word</span>
            <p className="devanagari" lang="sa">आयुध</p>
            <p className="iast">āyudha</p>
          </article>
          <div className="meaning-arrow" aria-hidden><span /></div>
          <article className="glass meaning-card reveal">
            <span className="label">What it means in Sanskrit</span>
            <p className="meaning-big">a weapon, an instrument, an implement</p>
            <p className="note">A dictionary meaning: something held and used to get a thing done.</p>
          </article>
          <div className="meaning-arrow" aria-hidden><span /></div>
          <article className="glass meaning-card accent reveal">
            <span className="label">How Ayudhas reads it</span>
            <p className="meaning-big">tools that help people do what they set out to do</p>
            <p className="note">This is our interpretation, a metaphor for useful software, not a claim about the word&apos;s history.</p>
          </article>
        </div>

        <ol className="philosophy">
          {PHILOSOPHY.map((p) => (
            <li key={p.n} className="glass reveal">
              <span className="phil-n" aria-hidden>{p.n}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
