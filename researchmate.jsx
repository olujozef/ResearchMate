import { useState, useRef, useEffect } from "react";

const TABS = ["Citations", "Literature Review", "Research Outline"];

const disciplineOptions = [
  "Computer Science", "Medicine & Health", "Law", "Economics",
  "Psychology", "Biology", "History", "Engineering",
  "Sociology", "Philosophy", "Education", "Political Science"
];

const citationStyles = ["APA 7th", "MLA 9th", "Chicago 17th", "Harvard", "IEEE", "Vancouver"];

async function callClaude(systemPrompt, userPrompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await response.json();
  return data.content?.[0]?.text || "No response received.";
}

function LoadingDots() {
  return (
    <span className="loading-dots">
      <span>.</span><span>.</span><span>.</span>
    </span>
  );
}

function CitationsTab({ discipline, citationStyle: globalStyle }) {
  const [input, setInput] = useState("");
  const [citations, setCitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reformatting, setReformatting] = useState({}); // { citId: true }
  const [annotating, setAnnotating] = useState({});     // { citId: true }
  const [annotations, setAnnotations] = useState({});   // { citId: text }
  const [selectedStyle, setSelectedStyle] = useState(globalStyle || "APA 7th");
  const [copyFeedback, setCopyFeedback] = useState({});  // { citId: true }
  const [refornatTargetStyle, setReformatTargetStyle] = useState({}) // {citId: style}

  const ALL_STYLES = ["APA 7th", "MLA 9th", "Chicago 17th", "Harvard", "IEEE", "Vancouver"];

  const formatRaw = async (rawText, style) => {
    const system = `You are an academic citation formatter. Format citations precisely in ${style} style for a ${discipline} researcher. Return ONLY a JSON array of citation objects with fields: formatted (string), type (string: journal/book/website/other), year (number), title (string). No explanation, no markdown. Do not use em dashes.`;
    const user = `Format these sources into proper ${style} citations:\n\n${rawText}`;
    const raw = await callClaude(system, user);
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  };

  const handleFormat = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const parsed = await formatRaw(input, selectedStyle);
      setCitations(prev => [...prev, ...parsed.map((c, i) => ({
        ...c,
        id: Date.now() + i,
        style: selectedStyle
      }))]);
      setInput("");
    } catch {
      setCitations(prev => [...prev, {
        id: Date.now(),
        formatted: input,
        type: "other",
        year: new Date().getFullYear(),
        title: "Unformatted source",
        style: selectedStyle
      }]);
    }
    setLoading(false);
  };

  const handleReformat = async (cit, newStyle) => {
    setReformatting(prev => ({ ...prev, [cit.id]: true }));
    try {
      const parsed = await formatRaw(cit.formatted, newStyle);
      const updated = parsed[0];
      setCitations(prev => prev.map(c =>
        c.id === cit.id
          ? { ...c, formatted: updated.formatted, style: newStyle, type: updated.type || c.type, year: updated.year || c.year }
          : c
      ));
    } catch {}
    setReformatting(prev => ({ ...prev, [cit.id]: false }));
    setReformatTargetStyle(prev => ({ ...prev, [cit.id]: undefined }));
  };

  const handleAnnotate = async (cit) => {
    setAnnotating(prev => ({ ...prev, [cit.id]: true }));
    const system = `You are a research assistant for a ${discipline} student. Write a 2-sentence annotation that says exactly what this source argues or finds, and what it contributes to the research. Be specific: name the method, the finding, or the argument. Do not use vague phrases like "this source explores" or "the author examines." Do not use em dashes.`;
    const result = await callClaude(system, `Write a brief annotation for this citation: ${cit.formatted}`);
    setAnnotations(prev => ({ ...prev, [cit.id]: result }));
    setAnnotating(prev => ({ ...prev, [cit.id]: false }));
  };

  const handleCopy = (cit) => {
    navigator.clipboard.writeText(cit.formatted);
    setCopyFeedback(prev => ({ ...prev, [cit.id]: true }));
    setTimeout(() => setCopyFeedback(prev => ({ ...prev, [cit.id]: false })), 1500);
  };

  const copyAll = () => {
    const all = citations.map((c, i) => `${i + 1}. ${c.formatted}`).join("\n\n");
    navigator.clipboard.writeText(all);
  };

  const remove = (id) => {
    setCitations(prev => prev.filter(c => c.id !== id));
    setAnnotations(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  return (
    <div className="tab-content">
      <div className="section-header">
        <h2>Citation Organizer</h2>
        <p className="subtitle">Paste your raw references (titles, URLs, DOIs, or messy citation lists) and format them into any academic style. You can reformat individual entries into a different style at any time.</p>
      </div>

      <div className="input-card">
        <label className="input-label">Raw Sources</label>
        <textarea
          className="main-textarea"
          placeholder={`Paste your sources here, one per line.\nE.g.: Smith, John. The Structure of Scientific Revolutions. University of Chicago Press, 1962.\nOr: https://doi.org/10.1000/xyz123`}
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={5}
        />

        <label className="input-label" style={{ marginTop: "1.1rem" }}>Format Into</label>
        <div className="style-selector">
          {ALL_STYLES.map(s => (
            <button
              key={s}
              className={`style-pill ${selectedStyle === s ? "active" : ""}`}
              onClick={() => setSelectedStyle(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <button className="btn-primary" onClick={handleFormat} disabled={loading || !input.trim()}>
          {loading ? <><LoadingDots /> Formatting</> : `Format as ${selectedStyle}`}
        </button>
      </div>

      {citations.length > 0 && (
        <div className="citations-list">
          <div className="list-header">
            <span>{citations.length} citation{citations.length !== 1 ? "s" : ""}</span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-ghost" onClick={copyAll}>Copy all</button>
              <button className="btn-ghost" onClick={() => setCitations([])}>Clear all</button>
            </div>
          </div>
          {citations.map(cit => (
            <div key={cit.id} className="citation-card">
              <div className="citation-meta">
                <span className={`badge badge-${cit.type}`}>{cit.type}</span>
                <span className="year-badge">{cit.year}</span>
                <span className="style-tag">{cit.style}</span>
                {reformatting[cit.id] && <span className="reformatting-label"><LoadingDots /> Reformatting</span>}
              </div>

              <p className="citation-text">{cit.formatted}</p>

              {annotations[cit.id] && (
                <div className="annotation-inline">
                  <span className="annotation-label">Annotation</span>
                  <p className="annotation-text">{annotations[cit.id]}</p>
                </div>
              )}

              <div className="citation-actions-row">
                <div className="reformat-row">
                  <span className="reformat-label">Reformat as:</span>
                  {ALL_STYLES.filter(s => s !== cit.style).map(s => (
                    <button
                      key={s}
                      className="btn-style-switch"
                      disabled={!!reformatting[cit.id]}
                      onClick={() => handleReformat(cit, s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="citation-actions">
                  <button
                    className="btn-small"
                    onClick={() => handleAnnotate(cit)}
                    disabled={!!annotating[cit.id]}
                  >
                    {annotating[cit.id] ? <LoadingDots /> : annotations[cit.id] ? "Re-annotate" : "Annotate"}
                  </button>
                  <button className={`btn-small btn-copy ${copyFeedback[cit.id] ? "copied" : ""}`} onClick={() => handleCopy(cit)}>
                    {copyFeedback[cit.id] ? "Copied!" : "Copy"}
                  </button>
                  <button className="btn-small btn-danger" onClick={() => remove(cit.id)}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LiteratureTab({ discipline, university, citationStyle }) {
  const [topic, setTopic] = useState("");
  const [sources, setSources] = useState("");
  const [focus, setFocus] = useState("thematic");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const synthesize = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setResult("");
    const system = `You are an academic writing assistant for a ${discipline} researcher at ${university || "a university"}. Write like a sharp academic, not a textbook. No filler phrases like "it is worth noting," "scholars have argued," "it is important to acknowledge," or "this field has seen growing interest." State what the research actually shows. Use direct, confident prose. Name real tensions between studies, not vague gaps. Never start a sentence with "Furthermore," "Moreover," or "In conclusion." Do not use em dashes anywhere in your output. When citing sources in the text, use ${citationStyle} in-text citation format.`;
    const user = `Write a ${focus} literature review on: "${topic}"\n\n${sources ? `Sources or themes to address:\n${sources}\n\n` : ""}Write 400 to 500 words. Use clear thematic paragraphs. State what studies found, where they disagree, and what remains unresolved. Be specific about what the research actually shows in ${discipline}. Use ${citationStyle} in-text citation style throughout. Do not use em dashes.`;
    const text = await callClaude(system, user);
    setResult(text);
    setLoading(false);
  };

  return (
    <div className="tab-content">
      <div className="section-header">
        <h2>Literature Review Synthesizer</h2>
        <p className="subtitle">Generate structured, discipline-specific literature reviews with identified research gaps and thematic synthesis. In-text citations will use <strong>{citationStyle}</strong> format, set in your Academic Profile above.</p>
      </div>

      <div className="input-card">
        <label className="input-label">Research Topic</label>
        <input
          className="main-input"
          placeholder={`E.g., "The impact of machine learning on clinical diagnostics"`}
          value={topic}
          onChange={e => setTopic(e.target.value)}
        />

        <label className="input-label" style={{ marginTop: "1rem" }}>Key Sources or Themes <span className="optional">(optional)</span></label>
        <textarea
          className="main-textarea"
          placeholder="List key authors, theories, or themes you want addressed..."
          value={sources}
          onChange={e => setSources(e.target.value)}
          rows={3}
        />

        <label className="input-label" style={{ marginTop: "1rem" }}>Synthesis Approach</label>
        <div className="radio-group">
          {[["thematic", "Thematic"], ["chronological", "Chronological"], ["methodological", "Methodological"], ["theoretical", "Theoretical"]].map(([val, label]) => (
            <label key={val} className={`radio-option ${focus === val ? "active" : ""}`}>
              <input type="radio" value={val} checked={focus === val} onChange={() => setFocus(val)} />
              {label}
            </label>
          ))}
        </div>

        <button className="btn-primary" onClick={synthesize} disabled={loading || !topic.trim()}>
          {loading ? <><LoadingDots /> Synthesizing</> : "Synthesize Literature"}
        </button>
      </div>

      {result && (
        <div className="result-box lit-result">
          <div className="result-label">Literature Review Draft</div>
          <div className="result-text">{result}</div>
          <div className="result-actions">
            <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(result)}>Copy to clipboard</button>
            <button className="btn-ghost" onClick={() => setResult("")}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

function OutlineTab({ discipline, university }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("research-paper");
  const [requirements, setRequirements] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const paperTypes = [
    ["research-paper", "Research Paper"],
    ["thesis", "Thesis/Dissertation"],
    ["literature-review", "Literature Review"],
    ["case-study", "Case Study"],
    ["systematic-review", "Systematic Review"],
    ["conference-paper", "Conference Paper"],
  ];

  const generate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setResult("");
    const system = `You are an academic writing coach for ${discipline} at ${university || "a university"}. Build outlines that are specific to the actual topic, not generic templates. Every section header and sub-point must reflect what this particular paper is about. Do not write placeholder labels like "Introduction" with no content underneath. Do not use em dashes anywhere in your output.`;
    const user = `Build a detailed outline for a ${type.replace("-", " ")} titled:\n"${title}"\n\nDiscipline: ${discipline}\n${requirements ? `Requirements: ${requirements}\n` : ""}For each section, include: what it must argue or establish, 2 to 3 specific questions it should answer, and a word count target. Add brief methodological notes where the discipline requires it. Use numbered hierarchy. Make every label and sub-point specific to this topic. Do not use em dashes.`;
    const text = await callClaude(system, user);
    setResult(text);
    setLoading(false);
  };

  return (
    <div className="tab-content">
      <div className="section-header">
        <h2>Research Outline Generator</h2>
        <p className="subtitle">Get a tailored, structured outline with section breakdowns, key questions, and word count guidance for your specific assignment.</p>
      </div>

      <div className="input-card">
        <label className="input-label">Paper Title or Research Question</label>
        <input
          className="main-input"
          placeholder={`E.g., "Examining algorithmic bias in hiring systems across sub-Saharan Africa"`}
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <label className="input-label" style={{ marginTop: "1rem" }}>Document Type</label>
        <div className="pill-group">
          {paperTypes.map(([val, label]) => (
            <button
              key={val}
              className={`pill ${type === val ? "active" : ""}`}
              onClick={() => setType(val)}
            >{label}</button>
          ))}
        </div>

        <label className="input-label" style={{ marginTop: "1rem" }}>Instructor / University Requirements <span className="optional">(optional)</span></label>
        <textarea
          className="main-textarea"
          placeholder="E.g., 3000 words, must include methodology section, APA format, cover policy implications..."
          value={requirements}
          onChange={e => setRequirements(e.target.value)}
          rows={3}
        />

        <button className="btn-primary" onClick={generate} disabled={loading || !title.trim()}>
          {loading ? <><LoadingDots /> Building outline</> : "Generate Outline"}
        </button>
      </div>

      {result && (
        <div className="result-box outline-result">
          <div className="result-label">Research Outline</div>
          <pre className="outline-text">{result}</pre>
          <div className="result-actions">
            <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(result)}>Copy to clipboard</button>
            <button className="btn-ghost" onClick={() => setResult("")}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

const SECTION_TYPES = [
  { id: "abstract",         label: "Abstract",          icon: "◈" },
  { id: "introduction",     label: "Introduction",      icon: "◎" },
  { id: "executive-summary",label: "Executive Summary", icon: "◉" },
  { id: "methodology",      label: "Methodology",       icon: "◧" },
  { id: "results",          label: "Results / Findings",icon: "◆" },
  { id: "discussion",       label: "Discussion",        icon: "◇" },
  { id: "conclusion",       label: "Conclusion",        icon: "◐" },
  { id: "acknowledgement",  label: "Acknowledgement",   icon: "◑" },
];

const SECTION_CONFIGS = {
  "abstract": {
    desc: "A concise summary of your entire paper: the problem, approach, key findings, and conclusion. Written last but placed first.",
    fields: [
      { key: "topic",    label: "Research topic or paper title",          placeholder: "E.g., Bias in facial recognition systems used in Nigerian border control", rows: 1 },
      { key: "problem",  label: "The core problem or gap you address",     placeholder: "E.g., Existing systems show 34% higher error rates for darker skin tones yet are deployed without audit frameworks in West Africa", rows: 2 },
      { key: "approach", label: "How you studied it (method in one line)", placeholder: "E.g., Comparative audit of three deployed systems using FairFace benchmark dataset", rows: 1 },
      { key: "findings", label: "Key finding(s)",                         placeholder: "E.g., All three systems failed equity thresholds; none had documented bias testing prior to deployment", rows: 2 },
      { key: "wordlimit",label: "Word limit (optional)",                  placeholder: "E.g., 250 words", rows: 1 },
    ]
  },
  "introduction": {
    desc: "Sets up your research: what the problem is, why it matters, what others have missed, and what your paper will do about it.",
    fields: [
      { key: "topic",     label: "Research topic or paper title",          placeholder: "E.g., Community policing and trust deficits in urban Lagos", rows: 1 },
      { key: "problem",   label: "The problem or gap in existing knowledge",placeholder: "E.g., Most policing literature focuses on Western cities; Nigerian community dynamics are largely absent from the scholarship", rows: 2 },
      { key: "aims",      label: "Your aims or research questions",        placeholder: "E.g., (1) What factors drive trust deficits? (2) How do community leaders mediate police-public relations?", rows: 2 },
      { key: "context",   label: "Any relevant background or context",     placeholder: "E.g., Post-EndSARS environment, SARS disbandment in 2020, SWAT formation", rows: 2 },
      { key: "wordlimit", label: "Word limit (optional)",                  placeholder: "E.g., 600 words", rows: 1 },
    ]
  },
  "executive-summary": {
    desc: "Used in policy papers, reports, and professional documents. Tells a non-specialist reader what the report is about, what you found, and what should be done.",
    fields: [
      { key: "title",     label: "Report or project title",                placeholder: "E.g., Assessment of AI Procurement Standards in Nigerian Federal Agencies", rows: 1 },
      { key: "purpose",   label: "Purpose of the report",                  placeholder: "E.g., To evaluate whether current procurement processes account for algorithmic risk in AI tools", rows: 2 },
      { key: "findings",  label: "Two or three main findings",             placeholder: "E.g., No agency had an AI impact assessment framework; vendors self-certified compliance", rows: 2 },
      { key: "recommendations", label: "Key recommendations",             placeholder: "E.g., Mandatory third-party audits, open procurement criteria, regulatory sandbox for pilot tools", rows: 2 },
      { key: "audience",  label: "Primary audience",                       placeholder: "E.g., Policy advisors at NITDA, non-technical government decision-makers", rows: 1 },
    ]
  },
  "methodology": {
    desc: "Explains how you conducted your research, why you chose that approach, and how you collected and analysed your data.",
    fields: [
      { key: "topic",     label: "Research topic or question",             placeholder: "E.g., How do informal savings groups (ajo) adapt to mobile money adoption in Osun State", rows: 1 },
      { key: "approach",  label: "Research approach or design",            placeholder: "E.g., Qualitative case study; ethnographic observation and semi-structured interviews", rows: 2 },
      { key: "data",      label: "How you collected data",                 placeholder: "E.g., 18 interviews with ajo coordinators across Ede, Osogbo, and Ilesa; field notes from 6 group meetings", rows: 2 },
      { key: "analysis",  label: "How you analysed the data",              placeholder: "E.g., Thematic analysis using NVivo; coded for trust, adoption barriers, and group dynamics", rows: 2 },
      { key: "limits",    label: "Limitations or ethical considerations (optional)", placeholder: "E.g., Sample limited to women-led groups; IRB clearance obtained from OAU", rows: 2 },
    ]
  },
  "results": {
    desc: "Reports what you found without interpretation. Presents the data, patterns, or themes clearly and objectively.",
    fields: [
      { key: "topic",     label: "Research topic or question",             placeholder: "E.g., Relationship between broadband access and secondary school performance in rural Ogun State", rows: 1 },
      { key: "findings",  label: "Your main findings or results",          placeholder: "E.g., Schools with consistent broadband showed 22% higher WAEC pass rates; effect strongest in science subjects", rows: 3 },
      { key: "data",      label: "Key data points, themes, or patterns",   placeholder: "E.g., 3 of 5 schools without broadband had no functioning computer lab; teacher ICT confidence also correlated", rows: 2 },
      { key: "structure", label: "How you want it structured",             placeholder: "E.g., By theme (infrastructure, performance, teacher readiness) or by research question", rows: 1 },
    ]
  },
  "discussion": {
    desc: "Interprets your results. Explains what your findings mean, how they compare to prior research, and what they imply for the field.",
    fields: [
      { key: "topic",     label: "Research topic",                         placeholder: "E.g., Algorithmic content moderation and political speech suppression in Anglophone Africa", rows: 1 },
      { key: "findings",  label: "Your key findings (summary)",            placeholder: "E.g., 68% of flagged posts in sample were from opposition politicians; Meta's own audit confirmed geographic bias", rows: 2 },
      { key: "literature",label: "How do your findings compare to existing literature", placeholder: "E.g., Confirms Gorwa (2019) on platform governance gaps; challenges Klonick (2018) who argued self-regulation was sufficient", rows: 2 },
      { key: "implications", label: "What do the findings mean or imply",  placeholder: "E.g., Platforms cannot self-regulate in low-accountability environments; African regulatory capacity needs investment", rows: 2 },
    ]
  },
  "conclusion": {
    desc: "Closes your paper. Restates what you argued, what you proved, what the limitations were, and where research should go next.",
    fields: [
      { key: "topic",     label: "Research topic or paper title",          placeholder: "E.g., Land tenure insecurity and smallholder farmer investment in climate-adaptive agriculture", rows: 1 },
      { key: "argument",  label: "The main argument or thesis of your paper", placeholder: "E.g., Insecure tenure systematically suppresses long-term investment even when farmers understand climate risk", rows: 2 },
      { key: "proven",    label: "What your paper established or proved",   placeholder: "E.g., Survey data from 400 farmers in Benue showed tenure security as the strongest predictor of investment, over income or education", rows: 2 },
      { key: "future",    label: "Gaps left open or future research directions", placeholder: "E.g., Long-term panel data needed; customary vs statutory tenure distinction requires further study", rows: 2 },
      { key: "wordlimit", label: "Word limit (optional)",                  placeholder: "E.g., 400 words", rows: 1 },
    ]
  },
  "acknowledgement": {
    desc: "Thanks the people and institutions that made your research possible. Supervisors, funders, research participants, and personal support.",
    fields: [
      { key: "supervisors",  label: "Supervisors or academic mentors",     placeholder: "E.g., Prof. Adebayo Okafor (primary supervisor), Dr. Sarah Mensah (co-supervisor)", rows: 1 },
      { key: "funders",      label: "Funding bodies or grants (optional)", placeholder: "E.g., Supported by the MacArthur Foundation Nigeria Grant 2024", rows: 1 },
      { key: "participants", label: "Research participants or institutions (optional)", placeholder: "E.g., Community members in Ede North LGA who gave their time for interviews", rows: 1 },
      { key: "personal",     label: "Personal acknowledgements (optional)", placeholder: "E.g., Family, colleagues, anyone who provided support during the research", rows: 1 },
      { key: "tone",         label: "Tone",                                placeholder: "Formal (thesis/journal) or warm (dissertation/book)", rows: 1 },
    ]
  },
};

function SectionWriterTab({ discipline, university, citationStyle }) {
  const [activeSection, setActiveSection] = useState("abstract");
  const [fieldValues, setFieldValues] = useState({});
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [copyFeedback, setCopyFeedback] = useState({});

  const config = SECTION_CONFIGS[activeSection];

  const setField = (key, value) => {
    setFieldValues(prev => ({ ...prev, [activeSection]: { ...(prev[activeSection] || {}), [key]: value } }));
  };

  const getField = (key) => (fieldValues[activeSection] || {})[key] || "";

  const buildPrompt = (sectionId, values) => {
    const sysMap = {
      "abstract": `Write a precise academic abstract for a ${discipline} paper at ${university || "a university"}. An abstract states the problem, method, findings, and conclusion in that order. No filler. No "this paper aims to." Say what you did and what you found. Do not use em dashes. Use ${citationStyle} if citing.`,
      "introduction": `Write an introduction section for a ${discipline} paper at ${university || "a university"}. Open with the problem, not with broad history. Establish the gap in the literature concisely. State the research aims clearly. Write like someone who knows the field, not like a textbook opener. Do not use em dashes.`,
      "executive-summary": `Write an executive summary for a ${discipline} report for ${university || "an organisation"}. The audience is decision-makers, not researchers. Lead with the purpose, then findings, then what should be done. Use plain, direct sentences. No academic hedging. Do not use em dashes.`,
      "methodology": `Write a methodology section for a ${discipline} paper. State the design, justify it briefly, explain data collection and analysis clearly. Be specific about numbers and procedures. Do not say "a robust methodology was employed." Say what was actually done and why. Do not use em dashes.`,
      "results": `Write a results/findings section for a ${discipline} paper. Report what was found without interpretation. Be specific: use numbers, themes, or patterns as given. Do not interpret or explain implications here. Organise clearly. Do not use em dashes.`,
      "discussion": `Write a discussion section for a ${discipline} paper. Interpret the findings. Compare them directly to what the literature expected or found. Name specific implications. Do not restate the results. Do not open with "The results of this study show." Move straight into interpretation. Do not use em dashes.`,
      "conclusion": `Write a conclusion section for a ${discipline} paper at ${university || "a university"}. Restate the argument, confirm what was proven, acknowledge limitations honestly, and suggest where research should go next. Do not introduce new ideas. Do not open with "In conclusion." Do not use em dashes.`,
      "acknowledgement": `Write an acknowledgement section. Be warm and specific, not generic. Thank people by name and role where provided. Keep it under 150 words unless tone is informal. Do not use em dashes.`,
    };

    const userMap = {
      "abstract": `Topic: ${values.topic || ""}\nProblem addressed: ${values.problem || ""}\nMethod: ${values.approach || ""}\nKey findings: ${values.findings || ""}${values.wordlimit ? `\nWord limit: ${values.wordlimit}` : ""}`,
      "introduction": `Topic: ${values.topic || ""}\nProblem or gap: ${values.problem || ""}\nAims or research questions: ${values.aims || ""}${values.context ? `\nContext: ${values.context}` : ""}${values.wordlimit ? `\nWord limit: ${values.wordlimit}` : ""}`,
      "executive-summary": `Report title: ${values.title || ""}\nPurpose: ${values.purpose || ""}\nMain findings: ${values.findings || ""}\nRecommendations: ${values.recommendations || ""}\nAudience: ${values.audience || ""}`,
      "methodology": `Topic: ${values.topic || ""}\nResearch approach: ${values.approach || ""}\nData collection: ${values.data || ""}\nAnalysis method: ${values.analysis || ""}${values.limits ? `\nLimitations: ${values.limits}` : ""}`,
      "results": `Topic: ${values.topic || ""}\nFindings: ${values.findings || ""}\nKey data or patterns: ${values.data || ""}\nStructure preference: ${values.structure || "thematic"}`,
      "discussion": `Topic: ${values.topic || ""}\nKey findings: ${values.findings || ""}\nComparison to literature: ${values.literature || ""}\nImplications: ${values.implications || ""}`,
      "conclusion": `Topic: ${values.topic || ""}\nMain argument: ${values.argument || ""}\nWhat was proven: ${values.proven || ""}\nFuture research: ${values.future || ""}${values.wordlimit ? `\nWord limit: ${values.wordlimit}` : ""}`,
      "acknowledgement": `Supervisors: ${values.supervisors || ""}\nFunders: ${values.funders || ""}\nParticipants or institutions: ${values.participants || ""}\nPersonal thanks: ${values.personal || ""}\nTone: ${values.tone || "formal"}`,
    };

    return { system: sysMap[sectionId], user: `Write this ${sectionId} section for a ${discipline} paper:\n\n${userMap[sectionId]}\n\nDo not use em dashes. Write in complete, polished prose ready to paste into the paper.` };
  };

  const handleGenerate = async () => {
    const values = fieldValues[activeSection] || {};
    const firstRequired = config.fields[0].key;
    if (!values[firstRequired]?.trim()) return;
    setLoading(prev => ({ ...prev, [activeSection]: true }));
    const { system, user } = buildPrompt(activeSection, values);
    const text = await callClaude(system, user);
    setResults(prev => ({ ...prev, [activeSection]: text }));
    setLoading(prev => ({ ...prev, [activeSection]: false }));
  };

  const handleCopy = (sectionId) => {
    navigator.clipboard.writeText(results[sectionId] || "");
    setCopyFeedback(prev => ({ ...prev, [sectionId]: true }));
    setTimeout(() => setCopyFeedback(prev => ({ ...prev, [sectionId]: false })), 1500);
  };

  const firstFieldKey = config.fields[0].key;
  const hasInput = !!(fieldValues[activeSection] || {})[firstFieldKey]?.trim();

  return (
    <div className="tab-content">
      <div className="section-header">
        <h2>Section Writer</h2>
        <p className="subtitle">Select a section, fill in what you know, and get a polished draft tailored to your discipline and paper. Each section has its own input fields so the output is specific to your work, not a generic template.</p>
      </div>

      <div className="section-type-grid">
        {SECTION_TYPES.map(s => (
          <button
            key={s.id}
            className={`section-type-btn ${activeSection === s.id ? "active" : ""} ${results[s.id] ? "has-result" : ""}`}
            onClick={() => setActiveSection(s.id)}
          >
            <span className="section-icon">{s.icon}</span>
            <span className="section-label">{s.label}</span>
            {results[s.id] && <span className="section-done-dot" title="Draft ready" />}
          </button>
        ))}
      </div>

      <div className="input-card" style={{ marginTop: "1.25rem" }}>
        <div className="section-desc">{config.desc}</div>

        {config.fields.map(f => (
          <div key={f.key} style={{ marginTop: "1rem" }}>
            <label className="input-label">{f.label}</label>
            {f.rows === 1
              ? <input className="main-input" placeholder={f.placeholder} value={getField(f.key)} onChange={e => setField(f.key, e.target.value)} />
              : <textarea className="main-textarea" placeholder={f.placeholder} value={getField(f.key)} onChange={e => setField(f.key, e.target.value)} rows={f.rows} />
            }
          </div>
        ))}

        <button className="btn-primary" onClick={handleGenerate} disabled={loading[activeSection] || !hasInput}>
          {loading[activeSection] ? <><LoadingDots /> Writing section</> : `Write ${SECTION_TYPES.find(s => s.id === activeSection)?.label}`}
        </button>
      </div>

      {results[activeSection] && (
        <div className="result-box">
          <div className="result-label">{SECTION_TYPES.find(s => s.id === activeSection)?.label} Draft</div>
          <div className="result-text">{results[activeSection]}</div>
          <div className="result-actions">
            <button className={`btn-ghost ${copyFeedback[activeSection] ? "copied-btn" : ""}`} onClick={() => handleCopy(activeSection)}>
              {copyFeedback[activeSection] ? "Copied!" : "Copy to clipboard"}
            </button>
            <button className="btn-ghost" onClick={() => setResults(prev => ({ ...prev, [activeSection]: "" }))}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResearchMate() {
  const [activeTab, setActiveTab] = useState(0);
  const [discipline, setDiscipline] = useState("Computer Science");
  const [citationStyle, setCitationStyle] = useState("APA 7th");
  const [university, setUniversity] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --ink: #1a1a14;
          --parchment: #f5f0e8;
          --cream: #faf8f4;
          --sage: #2d4a3e;
          --sage-light: #3d6b5a;
          --gold: #b5862a;
          --gold-light: #d4a94b;
          --rust: #8b3a2a;
          --muted: #7a7060;
          --border: #ddd8cc;
          --card: #ffffff;
          --radius: 6px;
        }

        body { background: var(--parchment); }

        .app {
          min-height: 100vh;
          background: var(--parchment);
          font-family: 'DM Sans', sans-serif;
          color: var(--ink);
        }

        /* Header */
        .header {
          background: var(--sage);
          padding: 0 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 3px solid var(--gold);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .logo-area {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 0;
        }

        .logo-mark {
          width: 36px;
          height: 36px;
          background: var(--gold);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Lora', serif;
          font-weight: 700;
          font-size: 1rem;
          color: var(--sage);
        }

        .logo-text {
          font-family: 'Lora', serif;
          font-size: 1.3rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
        }

        .logo-text span {
          color: var(--gold-light);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .discipline-badge {
          background: rgba(255,255,255,0.12);
          color: #e8e4da;
          font-size: 0.75rem;
          font-weight: 500;
          padding: 0.3rem 0.75rem;
          border-radius: 100px;
          border: 1px solid rgba(255,255,255,0.2);
          cursor: pointer;
          transition: background 0.2s;
        }
        .discipline-badge:hover { background: rgba(255,255,255,0.2); }

        .settings-btn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          font-size: 1.1rem;
          padding: 0.3rem;
          border-radius: 4px;
          transition: color 0.2s;
        }
        .settings-btn:hover { color: #fff; }

        /* Settings Panel */
        .settings-panel {
          background: var(--sage);
          border-bottom: 2px solid rgba(181,134,42,0.4);
          padding: 1rem 2rem;
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
          align-items: flex-end;
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .setting-field label {
          display: block;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.5);
          margin-bottom: 0.3rem;
        }

        .setting-field select,
        .setting-field input {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff;
          padding: 0.4rem 0.75rem;
          border-radius: var(--radius);
          font-size: 0.85rem;
          font-family: 'DM Sans', sans-serif;
          min-width: 180px;
        }
        .setting-field select option { background: var(--sage); }
        .setting-field input::placeholder { color: rgba(255,255,255,0.35); }

        /* Tabs */
        .tab-bar {
          background: var(--cream);
          border-bottom: 1px solid var(--border);
          display: flex;
          padding: 0 2rem;
          gap: 0;
        }

        .tab-btn {
          background: none;
          border: none;
          padding: 1rem 1.5rem;
          font-size: 0.9rem;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          color: var(--muted);
          cursor: pointer;
          border-bottom: 3px solid transparent;
          margin-bottom: -1px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .tab-btn:hover { color: var(--sage); }

        .tab-btn.active {
          color: var(--sage);
          border-bottom-color: var(--gold);
          font-weight: 600;
        }

        .tab-icon {
          font-size: 1rem;
        }

        /* Main content */
        .main {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
        }

        .tab-content { animation: fadeIn 0.25s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

        .section-header {
          margin-bottom: 1.5rem;
        }

        .section-header h2 {
          font-family: 'Lora', serif;
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: -0.02em;
          margin-bottom: 0.4rem;
        }

        .subtitle {
          font-size: 0.9rem;
          color: var(--muted);
          line-height: 1.5;
        }

        /* Cards */
        .input-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }

        .input-label {
          display: block;
          font-size: 0.78rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
          margin-bottom: 0.5rem;
        }

        .optional {
          font-weight: 400;
          text-transform: none;
          letter-spacing: 0;
          font-size: 0.75rem;
        }

        .main-input, .main-textarea {
          width: 100%;
          background: var(--parchment);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.75rem 1rem;
          font-size: 0.9rem;
          font-family: 'DM Sans', sans-serif;
          color: var(--ink);
          transition: border-color 0.2s;
          resize: vertical;
        }

        .main-input:focus, .main-textarea:focus {
          outline: none;
          border-color: var(--sage-light);
          box-shadow: 0 0 0 3px rgba(45,74,62,0.08);
        }

        .main-textarea { line-height: 1.5; }

        /* Buttons */
        .btn-primary {
          margin-top: 1rem;
          background: var(--sage);
          color: #fff;
          border: none;
          border-radius: var(--radius);
          padding: 0.75rem 1.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
        }

        .btn-primary:hover:not(:disabled) { background: var(--sage-light); }
        .btn-primary:active:not(:disabled) { transform: scale(0.98); }
        .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

        .btn-ghost {
          background: none;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.4rem 0.9rem;
          font-size: 0.8rem;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-ghost:hover { border-color: var(--sage); color: var(--sage); }

        .btn-small {
          background: none;
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 0.25rem 0.6rem;
          font-size: 0.75rem;
          font-family: 'DM Sans', sans-serif;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-small:hover { border-color: var(--sage); color: var(--sage); }
        .btn-copy:hover { border-color: var(--gold); color: var(--gold); }
        .btn-danger:hover { border-color: var(--rust); color: var(--rust); }

        /* Citations */
        .citations-list { margin-bottom: 1.5rem; }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .citation-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-left: 3px solid var(--gold);
          border-radius: var(--radius);
          padding: 1rem 1.1rem;
          margin-bottom: 0.75rem;
          transition: border-color 0.2s;
        }
        .citation-card:hover { border-left-color: var(--sage); }

        .citation-meta {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          align-items: center;
        }

        .badge {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: 100px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .badge-journal { background: #e8f0ec; color: var(--sage); }
        .badge-book { background: #f0ede6; color: #6b5233; }
        .badge-website { background: #e8eaf0; color: #3a4a8b; }
        .badge-other { background: #f0e8e8; color: var(--rust); }

        .year-badge {
          font-size: 0.72rem;
          color: var(--muted);
          font-weight: 500;
        }

        .citation-text {
          font-size: 0.88rem;
          line-height: 1.55;
          color: var(--ink);
          margin-bottom: 0.6rem;
          font-family: 'Lora', serif;
        }

        .citation-actions { display: flex; gap: 0.4rem; }

        /* Style selector */
        .style-selector {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-top: 0.3rem;
          margin-bottom: 0.25rem;
        }

        .style-pill {
          background: var(--parchment);
          border: 1px solid var(--border);
          border-radius: 100px;
          padding: 0.3rem 0.85rem;
          font-size: 0.78rem;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.15s;
        }
        .style-pill:hover { border-color: var(--sage); color: var(--sage); }
        .style-pill.active {
          background: var(--sage);
          color: #fff;
          border-color: var(--sage);
          font-weight: 600;
        }

        /* Style tag on citation card */
        .style-tag {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: 100px;
          background: #edf2f0;
          color: var(--sage);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border: 1px solid #c8dcd5;
        }

        .reformatting-label {
          font-size: 0.72rem;
          color: var(--muted);
          font-style: italic;
          display: flex;
          align-items: center;
          gap: 0.2rem;
        }

        /* Reformat row */
        .citation-actions-row {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .reformat-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.35rem;
        }

        .reformat-label {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
          margin-right: 0.15rem;
        }

        .btn-style-switch {
          background: none;
          border: 1px dashed var(--border);
          border-radius: 100px;
          padding: 0.18rem 0.6rem;
          font-size: 0.71rem;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-style-switch:hover:not(:disabled) { border-color: var(--gold); color: var(--gold); border-style: solid; }
        .btn-style-switch:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Inline annotation */
        .annotation-inline {
          background: #f7f4ee;
          border-left: 3px solid var(--gold);
          border-radius: 0 4px 4px 0;
          padding: 0.6rem 0.8rem;
          margin-bottom: 0.5rem;
        }

        .annotation-label {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--gold);
          display: block;
          margin-bottom: 0.3rem;
        }

        .annotation-text {
          font-size: 0.83rem;
          line-height: 1.55;
          color: var(--ink);
          font-style: italic;
        }

        /* Copy feedback */
        .btn-copy.copied {
          border-color: var(--sage);
          color: var(--sage);
          font-weight: 600;
        }

        /* Result box */
        .result-box {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 1.5rem;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }

        .result-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--gold);
          margin-bottom: 0.75rem;
        }

        .result-text {
          font-size: 0.92rem;
          line-height: 1.7;
          color: var(--ink);
          white-space: pre-wrap;
          font-family: 'Lora', serif;
        }

        .outline-text {
          font-size: 0.87rem;
          line-height: 1.75;
          color: var(--ink);
          white-space: pre-wrap;
          font-family: 'DM Sans', sans-serif;
          font-weight: 400;
        }

        .result-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }

        /* Radio group */
        .radio-group {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.25rem;
        }

        .radio-option {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: var(--parchment);
          border: 1px solid var(--border);
          border-radius: 100px;
          padding: 0.35rem 0.8rem;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.15s;
          font-weight: 500;
          color: var(--muted);
        }
        .radio-option input { display: none; }
        .radio-option.active { background: var(--sage); color: #fff; border-color: var(--sage); }

        /* Pill group */
        .pill-group {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-top: 0.25rem;
        }

        .pill {
          background: var(--parchment);
          border: 1px solid var(--border);
          border-radius: 100px;
          padding: 0.35rem 0.9rem;
          font-size: 0.8rem;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.15s;
        }
        .pill:hover { border-color: var(--sage); color: var(--sage); }
        .pill.active { background: var(--sage); color: #fff; border-color: var(--sage); }

        /* Loading */
        .loading-dots span {
          animation: blink 1.4s infinite;
          font-size: 1.1em;
        }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes blink { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }

        /* Footer */
        .footer {
          text-align: center;
          padding: 2rem;
          font-size: 0.75rem;
          color: var(--muted);
          border-top: 1px solid var(--border);
          margin-top: 2rem;
        }

        /* Settings panel overhaul */
        .settings-panel-title {
          width: 100%;
          font-family: 'Lora', serif;
          font-size: 0.85rem;
          font-weight: 600;
          color: rgba(255,255,255,0.6);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 0.75rem;
        }

        .settings-fields-row {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .setting-hint {
          font-weight: 400;
          text-transform: none;
          letter-spacing: 0;
          font-size: 0.68rem;
          opacity: 0.65;
          margin-left: 0.25rem;
        }

        /* Section type grid */
        .section-type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.5rem;
        }

        .section-type-btn {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.65rem 0.75rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 500;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          position: relative;
          text-align: left;
        }

        .section-type-btn:hover {
          border-color: var(--sage-light);
          color: var(--sage);
        }

        .section-type-btn.active {
          background: var(--sage);
          border-color: var(--sage);
          color: #fff;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(45,74,62,0.2);
        }

        .section-type-btn.has-result {
          border-color: var(--gold);
        }

        .section-type-btn.active.has-result {
          border-color: var(--sage);
        }

        .section-icon {
          font-size: 0.9rem;
          opacity: 0.7;
          flex-shrink: 0;
        }

        .section-label {
          flex: 1;
          line-height: 1.2;
        }

        .section-done-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--gold);
          flex-shrink: 0;
        }

        .section-type-btn.active .section-done-dot {
          background: var(--gold-light);
        }

        .section-desc {
          font-size: 0.84rem;
          color: var(--muted);
          line-height: 1.55;
          padding: 0.6rem 0.8rem;
          background: var(--parchment);
          border-radius: var(--radius);
          border-left: 3px solid var(--gold);
          margin-bottom: 0.25rem;
          font-style: italic;
        }

        .copied-btn {
          color: var(--sage) !important;
          border-color: var(--sage) !important;
          font-weight: 600 !important;
        }
      `}</style>

      <div className="app">
        <header className="header">
          <div className="logo-area">
            <div className="logo-mark">R</div>
            <div className="logo-text">Research<span>Mate</span></div>
          </div>
          <div className="header-right">
            <button className="discipline-badge" onClick={() => setSettingsOpen(o => !o)}>
              {discipline}{university ? ` · ${university}` : ""}
            </button>
            <button className="settings-btn" onClick={() => setSettingsOpen(o => !o)} title="Settings">
              ⚙
            </button>
          </div>
        </header>

        {settingsOpen && (
          <div className="settings-panel">
            <div className="settings-panel-title">Your Academic Profile</div>
            <div className="settings-fields-row">
              <div className="setting-field">
                <label>Discipline <span className="setting-hint">shapes tone and structure everywhere</span></label>
                <select value={discipline} onChange={e => setDiscipline(e.target.value)}>
                  {disciplineOptions.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="setting-field">
                <label>Citation Style <span className="setting-hint">used in Literature Review in-text citations</span></label>
                <select value={citationStyle} onChange={e => setCitationStyle(e.target.value)}>
                  {citationStyles.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="setting-field">
                <label>University <span className="setting-hint">optional, used in Lit Review and Outlines</span></label>
                <input
                  placeholder="E.g., University of Lagos"
                  value={university}
                  onChange={e => setUniversity(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <nav className="tab-bar">
          {[["📎", "Citations"], ["📚", "Literature Review"], ["🗂", "Research Outline"], ["✍️", "Section Writer"]].map(([icon, label], i) => (
            <button
              key={i}
              className={`tab-btn ${activeTab === i ? "active" : ""}`}
              onClick={() => setActiveTab(i)}
            >
              <span className="tab-icon">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <main className="main">
          {activeTab === 0 && <CitationsTab discipline={discipline} citationStyle={citationStyle} />}
          {activeTab === 1 && <LiteratureTab discipline={discipline} university={university} citationStyle={citationStyle} />}
          {activeTab === 2 && <OutlineTab discipline={discipline} university={university} />}
          {activeTab === 3 && <SectionWriterTab discipline={discipline} university={university} citationStyle={citationStyle} />}
        </main>

        <footer className="footer">
          ResearchMate · AI research assistant · Powered by Claude
        </footer>
      </div>
    </>
  );
}
