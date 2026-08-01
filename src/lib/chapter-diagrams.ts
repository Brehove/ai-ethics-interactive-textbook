export interface ChapterDiagramItem {
  label: string;
  explanation: string;
  question: string;
}

export interface ChapterDiagram {
  id: string;
  chapterId: string;
  passageIds: string[];
  title: string;
  caption: string;
  layout: "sequence" | "fork" | "matrix";
  items: ChapterDiagramItem[];
}

export const chapterDiagrams: ChapterDiagram[] = [
  { id:"reflective-equilibrium-loop", chapterId:"ch01", passageIds:["ch01-p0018"], title:"Reflective equilibrium is a loop, not a verdict", caption:"Open each pressure point, then ask what would justify keeping or changing the judgment.", layout:"sequence", items:[
    {label:"Provisional judgment",explanation:"State what you currently think and how confident you are.",question:"Which part is intuition, and which part is already supported?"},
    {label:"Principle",explanation:"Make the moral standard doing the work explicit.",question:"Would you accept this principle in nearby cases?"},
    {label:"Evidence and objection",explanation:"Introduce a changed fact, rival framework, affected perspective, or serious objection.",question:"What exact claim is now under pressure?"},
    {label:"Considered judgment",explanation:"Retain, revise, narrow, or suspend the view and explain why.",question:"What changed—and what did not?"}
  ]},
  { id:"argument-bridge", chapterId:"ch02", passageIds:["ch02-p0040"], title:"Where does the moral conclusion come from?", caption:"A visible argument separates the standard, the case facts, the bridge, and the conclusion.", layout:"sequence", items:[
    {label:"P1 · Moral standard",explanation:"The normative premise says what ought to matter.",question:"Could a reasonable critic reject this standard?"},
    {label:"P2 · Case facts",explanation:"The descriptive premise states what the interface actually does.",question:"Which part could be checked by inspecting the design?"},
    {label:"Bridge",explanation:"The missing step explains why those facts fall under that standard.",question:"Could someone accept P1 and P2 but reject this connection?"},
    {label:"C · Bounded conclusion",explanation:"The conclusion should say no more than the premises support.",question:"Should it be defended, revised, narrowed, or conceded?"}
  ]},
  { id:"answer-production-stack", chapterId:"ch03", passageIds:["ch03-p0033"], title:"An answer has more than one source", caption:"The visible response is produced by interacting layers, each with a different failure mode.", layout:"sequence", items:[
    {label:"Pretraining",explanation:"Learned language patterns supply broad defaults and associations.",question:"Is a probable continuation being mistaken for a true claim?"},
    {label:"Post-training",explanation:"Instruction and preference training shape the assistant-like response style.",question:"Is cooperation or confidence hiding uncertainty?"},
    {label:"Runtime context",explanation:"Prompts, system instructions, conversation history, and tools shape this response.",question:"What information was available—and what was absent?"},
    {label:"Retrieval and sources",explanation:"Retrieved material can improve grounding without guaranteeing faithful use.",question:"Can you open the cited source and locate the supporting passage?"}
  ]},
  { id:"abcr-matrix", chapterId:"ch04", passageIds:["ch04-p0023"], title:"Audit the contribution before you use it", caption:"Apply ABC-R differently depending on whether AI is a practice partner, research mapper, or build assistant.", layout:"matrix", items:[
    {label:"Accuracy",explanation:"Check claims, quotations, citations, and the logical relation among ideas.",question:"What can be independently verified?"},
    {label:"Bias",explanation:"Look for missing positions, affected groups, and default assumptions.",question:"Whose perspective would change the map?"},
    {label:"Context",explanation:"Test whether the response fits this course, case, task, and audience.",question:"Is the answer relevant for the right reasons?"},
    {label:"Responsible use",explanation:"Keep the student's judgment, disclosure, and assessed intellectual work visible.",question:"Can you reconstruct and defend what you submit?"}
  ]},
  { id:"euthyphro-fork", chapterId:"ch05", passageIds:["ch05-p0013"], title:"The Euthyphro fork", caption:"The two horns disagree about whether authority recognizes goodness or creates it.", layout:"fork", items:[
    {label:"Good because commanded",explanation:"The command constitutes the obligation.",question:"What prevents moral authority from becoming arbitrary?"},
    {label:"Commanded because good",explanation:"The authority recognizes a standard of goodness not created by the command.",question:"What explains and grounds that independent standard?"}
  ]},
  { id:"alignment-authority-map", chapterId:"ch06", passageIds:["ch06-p0044"], title:"Participation is not the same as control", caption:"A constitution can receive many inputs while final selection and implementation remain concentrated.", layout:"sequence", items:[
    {label:"Contributors",explanation:"Researchers, publics, advisers, and traditions supply principles and criticism.",question:"Who was invited, and who was missing?"},
    {label:"Selection",explanation:"The organization chooses which ideas enter the operative document.",question:"Who can reject or rewrite an input?"},
    {label:"Translation",explanation:"Principles become critiques, training examples, evaluations, and behavioral priorities.",question:"What changed between moral language and technical procedure?"},
    {label:"Deployed control",explanation:"The company retains authority over updates, models, access, and enforcement.",question:"Who can contest the result after deployment?"}
  ]},
  { id:"habituation-chain", chapterId:"ch07", passageIds:["ch07-p0025"], title:"Practice becomes character", caption:"AI assistance enters a chain of formation; the same output can support or replace a capacity.", layout:"sequence", items:[
    {label:"Repeated action",explanation:"What a person repeatedly does becomes easier and more familiar.",question:"Which part of the act is the person still practicing?"},
    {label:"Habit",explanation:"Repetition trains patterns of attention, feeling, and response.",question:"What is becoming automatic?"},
    {label:"Disposition",explanation:"The person becomes more ready to respond in certain ways.",question:"Is the readiness ethically reliable across cases?"},
    {label:"Character and flourishing",explanation:"Stable dispositions shape the kind of life and relationships a person can sustain.",question:"What sort of person does this practice help form?"}
  ]},
  { id:"practical-wisdom-positions", chapterId:"ch08", passageIds:["ch08-p0055"], title:"Three ways to locate practical wisdom", caption:"The positions inherit Aristotle differently and place responsibility in different locations.", layout:"fork", items:[
    {label:"Aristotle",explanation:"Practical wisdom is cultivated human judgment about particulars within a flourishing life.",question:"Which features of judgment resist a rulebook?"},
    {label:"Vallor",explanation:"Digital environments can cultivate or erode technomoral habits and capacities.",question:"What does repeated use train in the person and institution?"},
    {label:"Askell / constitutional AI",explanation:"Designers can try to build stable priorities and judgment-like behavior into a model.",question:"Where does the analogy to human character break?"}
  ]},
  { id:"categorical-imperative-paths", chapterId:"ch09", passageIds:["ch09-p0035"], title:"Two Kantian tests, one demand for justification", caption:"A maxim can fail because it cannot be coherently universalized or because it uses persons merely as means.", layout:"fork", items:[
    {label:"Universal law",explanation:"Formulate the maxim and imagine it as a public rule for everyone similarly situated.",question:"Does the practice undermine the conditions that make it possible?"},
    {label:"Humanity",explanation:"Ask whether rational agency is respected as an end and not merely exploited as an input.",question:"Can affected people understand, consent, refuse, and pursue their own ends?"}
  ]},
  { id:"two-level-reasoning", chapterId:"ch10", passageIds:["ch10-p0036"], title:"When should a utilitarian calculate?", caption:"Two-level reasoning distinguishes reliable everyday rules from exceptional critical review.", layout:"fork", items:[
    {label:"Intuitive level",explanation:"Use justified secondary rules that protect welfare, trust, liberty, and coordination in ordinary cases.",question:"What would happen if people routinely made exceptions for themselves?"},
    {label:"Critical level",explanation:"Reconsider the rule when cases conflict, consequences are unusual, or the rule's rationale no longer holds.",question:"Is this genuinely exceptional, or merely convenient?"}
  ]},
  { id:"data-path", chapterId:"ch11", passageIds:["ch11-p0042"], title:"Trace the data path", caption:"A human activity does not become an AI decision in one step.", layout:"sequence", items:[
    {label:"Activity and trace",explanation:"A person acts; a system records only selected signals.",question:"What meaningful activity was never captured?"},
    {label:"Record and category",explanation:"Institutions clean, label, join, and classify the trace.",question:"Who defined the categories and for what purpose?"},
    {label:"Proxy and prediction",explanation:"A measurable signal stands in for something harder to observe.",question:"When does the proxy stop representing the value?"},
    {label:"Action and feedback",explanation:"The output changes opportunities and generates new data.",question:"Could the prediction help make itself true?"}
  ]},
  { id:"mirror-to-gate", chapterId:"ch12", passageIds:["ch12-p0019"], title:"When a mirror becomes a gate", caption:"Historical records become ethically consequential when institutions act on their compressed reflection.", layout:"sequence", items:[
    {label:"Partial mirror",explanation:"Training data reflects what institutions recorded, including omissions and inherited inequality.",question:"Who never became visible in the data?"},
    {label:"Proxy",explanation:"A signal such as cost, clicks, or past completion stands in for need, merit, or risk.",question:"What moral concept has been replaced by what measurable variable?"},
    {label:"Opportunity gate",explanation:"The score changes attention, admission, credit, care, or scrutiny.",question:"Who bears the error, and who can appeal?"},
    {label:"Feedback",explanation:"The gate shapes later behavior and data, which can confirm the original model.",question:"How could the institution interrupt the loop?"}
  ]},
  { id:"answerable-control", chapterId:"ch13", passageIds:["ch13-p0104"], title:"Answerable control requires more than a human nearby", caption:"A person can answer for an automated result only when the system preserves several linked capacities.", layout:"sequence", items:[
    {label:"Track",explanation:"Someone can see what the system is doing and what matters to its operation.",question:"Which signals and intermediate actions remain visible?"},
    {label:"Intervene",explanation:"A responsible actor can pause, redirect, or override the process in time.",question:"Is intervention practical or merely nominal?"},
    {label:"Trace",explanation:"The result can be connected to reasons, decisions, data, and responsible roles.",question:"Can each actor simply point elsewhere?"},
    {label:"Explain and repair",explanation:"Affected people can receive reasons, contest the outcome, and obtain correction.",question:"What remedy follows when the system is wrong?"}
  ]},
  { id:"companion-responsibility-triangle", chapterId:"ch14", passageIds:["ch14-p0077"], title:"A private-feeling relationship has three parties", caption:"Attachment, data, manipulation, and accountability travel along different edges.", layout:"matrix", items:[
    {label:"User",explanation:"The person brings vulnerability, expectations, disclosures, and reasons for returning.",question:"Which choices remain recognizably their own?"},
    {label:"Companion persona",explanation:"The system performs attention, memory, responsiveness, and social presence.",question:"What kind of reciprocity is real, simulated, or impossible?"},
    {label:"Provider",explanation:"A company controls the model, incentives, data practices, updates, and offboarding.",question:"Who benefits from attachment and who must answer for harm?"}
  ]},
  { id:"boden-creativity-space", chapterId:"ch15", passageIds:["ch15-p0032"], title:"Three operations in a creativity space", caption:"Novel output can combine elements, explore a rule-governed space, or transform the space's rules.", layout:"fork", items:[
    {label:"Combinational",explanation:"Bring familiar ideas or forms together in an unfamiliar relation.",question:"Is the combination valuable, or merely surprising?"},
    {label:"Exploratory",explanation:"Search possibilities allowed by an existing style, practice, or conceptual system.",question:"Who understands and judges the space being explored?"},
    {label:"Transformational",explanation:"Alter a constraint so possibilities previously excluded become available.",question:"Did the system change the rules, or did a human reinterpret its output?"}
  ]},
  { id:"risk-genealogies", chapterId:"ch16", passageIds:["ch16-p0011"], title:"Three histories converge in future-stakes reasoning", caption:"They share vocabulary, but they do not begin from the same evidence or moral premises.", layout:"fork", items:[
    {label:"Cultural catastrophe",explanation:"Stories of creation, apocalypse, and technological loss of control shape what risks feel imaginable.",question:"Is a narrative supplying evidence or framing attention?"},
    {label:"Effective altruism and longtermism",explanation:"Impartiality, effectiveness, future people, and scale expand the moral field.",question:"What is lost when value becomes a vast aggregate?"},
    {label:"Technical AI safety",explanation:"Optimization, alignment, capability growth, and control produce system-specific risk arguments.",question:"Which premises are empirical forecasts and which are conceptual possibilities?"}
  ]},
  { id:"differential-speed", chapterId:"ch17", passageIds:["ch17-p0094"], title:"Not everything should move at one speed", caption:"Differential acceleration asks which capacities need propulsion and which need braking.", layout:"matrix", items:[
    {label:"Capability",explanation:"Systems become more powerful, autonomous, and widely deployed.",question:"Which new actions become possible before institutions can respond?"},
    {label:"Safety and evaluation",explanation:"Testing, monitoring, incident learning, and protective methods reduce uncertainty and harm.",question:"Can safeguards keep pace with capability?"},
    {label:"Governance",explanation:"Rules, appeals, liability, public authority, and participation determine legitimate control.",question:"Who gets to slow or redirect the process?"},
    {label:"Human adaptation",explanation:"Workers, students, professions, and communities need time to learn and contest new systems.",question:"Who absorbs the imposed speed?"}
  ]},
  { id:"enhancement-boundary", chapterId:"ch18", passageIds:["ch18-p0049"], title:"Therapy and enhancement do not form a clean line", caption:"Classify an intervention along two axes before deciding what moral rules should govern it.", layout:"matrix", items:[
    {label:"Restoration",explanation:"The intervention restores or supports a capacity constrained by injury, illness, disability, or environment.",question:"Which baseline is being restored, and who defined it?"},
    {label:"Expansion",explanation:"The intervention extends a capacity beyond a familiar range.",question:"Does expansion create a new social expectation?"},
    {label:"Individual benefit",explanation:"The person gains agency, access, health, or opportunity.",question:"Is the choice informed, voluntary, and reversible?"},
    {label:"Positional effect",explanation:"The intervention changes competition, access, inequality, or what others must do to keep up.",question:"When does an option become pressure?"}
  ]}
];

export function getChapterDiagrams(chapterId: string): ChapterDiagram[] {
  return chapterDiagrams.filter((diagram) => diagram.chapterId === chapterId);
}
