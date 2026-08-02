# Delegating Judgment: Automation, Robotics, Skill, and Answerable Control

<!-- phil-passage-id: ch13-p0001 -->
A driver turns on Tesla's Full Self-Driving system, the version Tesla currently labels [Full Self-Driving (Supervised)](https://www.tesla.com/support/fsd). The car follows a route, changes lanes, slows for traffic, and handles turns. From the passenger seat, it can look as if the car is driving. The person in the driver's seat may go several minutes without moving the wheel much at all. The screen shows a route. The car responds to traffic. The human watches.

<!-- phil-passage-id: ch13-p0002 -->
Tesla's own language still keeps the human inside the task. FSD Supervised operates under driver supervision, and Tesla's [owner materials](https://www.tesla.com/ownersmanual/model3/en_us/GUID-2CB60804-9CEA-4F4B-8B04-09B991368DC5.html) tell drivers to stay attentive and ready to take over. The [National Highway Traffic Safety Administration](https://www.nhtsa.gov/vehicle-safety/automated-vehicles-safety) makes the broader point about current consumer systems: even the highest level of driving automation available to consumers requires the driver's full engagement and undivided attention, and vehicles currently for sale in the United States are not fully automated or self-driving. This chapter does not try to settle whether Tesla's system is safe overall. The case makes a philosophical structure visible: a system performs much of the visible activity while a human remains officially responsible for supervision and intervention.

<!-- phil-passage-id: ch13-p0003 -->
This is an odd human role. If the driver is constantly steering, braking, and scanning, we know what the driver is doing. If the driver is asleep in the back seat, we also know the driver has abandoned the task. Supervised automation sits between those extremes. The car acts. The driver watches. The system has taken over much of the visible activity, while the human remains named as the responsible supervisor.

<!-- phil-passage-id: ch13-p0004 -->
The same structure is spreading into intellectual work. A student can ask an AI tool to build a research map: search for sources, summarize a field, identify themes, draft a structure, and suggest citations. A software developer can assign an issue to a coding agent. In tools such as [OpenAI Codex](https://developers.openai.com/codex/cloud), [GitHub Copilot coding agent](https://github.blog/ai-and-ml/github-copilot/assigning-and-completing-issues-with-coding-agent-in-github-copilot/), [Claude Code](https://www.anthropic.com/research/claude-code-expertise), or [Google Jules](https://jules.google/), an agent may read files, plan a change, edit code, run checks, and return a visible list of changes for human review. Software developers often call that reviewable package a diff or pull request. In ordinary language, it is a proposed change waiting for a person to inspect and approve.

<!-- phil-passage-id: ch13-p0005 -->
These company reports show how quickly delegated technical work is moving into some major AI and software organizations. Anthropic says in ["When AI builds itself"](https://www.anthropic.com/institute/recursive-self-improvement) that, as of May 2026, more than 80 percent of code merged into Anthropic's codebase was authored by Claude. That is Anthropic's wording, and it should be read with Anthropic's own caveats about human direction, review, quality, security, monitoring, and the limits of lines of code as a measure. [Alphabet's Q1 2025 earnings call](https://abc.xyz/investor/events/event-details/2025/2025-Q1-Earnings-Call/) gives another cautious signal. Sundar Pichai said that well over 30 percent of Google's checked-in code involved accepted AI-suggested solutions. Those company-specific claims justify a narrower ethical point: serious organizations are already reorganizing technical work around AI-assisted handoffs, while still relying on human expertise to direct, review, secure, and maintain the result.

<!-- phil-passage-id: ch13-p0006 -->
The question for this chapter is simple enough to ask and hard enough to answer:

<!-- phil-passage-id: ch13-p0007 -->
If the system performed much of the work chain, what did the human still know, practice, control, and answer for?

<!-- phil-passage-id: ch13-p0008 -->
In this chapter, **judgment** means more than producing an output. It means noticing what matters, interpreting context, weighing reasons, choosing a response, and being able to explain or repair the result. Automation becomes ethically serious when those parts of judgment move into a system while a human remains officially responsible.

<!-- phil-passage-id: ch13-p0009 -->
The chapter's practical standard is **answerable control**. A person or institution has answerable control when it can understand enough, intervene soon enough, and carry enough responsibility to explain, contest, repair, redirect, or refuse what the system does. A human in the loop is not automatically answerable. A person can be present and still lack information, skill, time, authority, or real intervention power.

<!-- phil-passage-id: ch13-p0010 -->
<aside class="textbox shaded" role="note" aria-labelledby="concept-map-delegated-judgment">
<h2 id="concept-map-delegated-judgment">Concept Map: Five Questions Of Delegated Judgment</h2>
<table class="shaded">
<caption>Five questions for evaluating delegated judgment</caption>
<thead>
<tr><th scope="col">Question</th><th scope="col">What it asks</th><th scope="col">Student version</th></tr>
</thead>
<tbody>
<tr><th scope="row">Handoff</th><td>What moved into the system?</td><td>Did AI search, rank, draft, decide, route, recommend, or approve?</td></tr>
<tr><th scope="row">Control</th><td>What is steering the loop?</td><td>What goal, proxy, metric, prompt, source, or feedback shaped the output?</td></tr>
<tr><th scope="row">Capacity</th><td>What human skill is being trained or weakened?</td><td>Did I still practice reading, checking, explaining, revising, or refusing?</td></tr>
<tr><th scope="row">Responsibility</th><td>Who can answer for the result?</td><td>Who has the knowledge, authority, and process trail to explain or repair it?</td></tr>
<tr><th scope="row">Answerability</th><td>What makes control meaningful?</td><td>Can someone understand, contest, redirect, stop, or fix the system in time?</td></tr>
</tbody>
</table>
</aside>

<!-- phil-passage-id: ch13-p0011 -->
This map is also a design map. To build like a philosopher is to design with visible assumptions, explicit values, reasoned tradeoffs, and contestable safeguards. The map asks what kind of human agency remains after the handoff.

<!-- phil-section-id: ch13-s001 -->
## Automation Is Older Than AI

<!-- phil-passage-id: ch13-p0012 -->
People have imagined artificial helpers for a very long time. Adrienne Mayor's work on ancient myths, summarized by [Stanford News](https://news.stanford.edu/stories/2019/02/ancient-myths-reveal-early-fantasies-artificial-life), treats figures such as Talos and Hephaestus's artificial servants as early fantasies of artificial life and automated labor. Classical source collections such as [Theoi's page on automata](https://www.theoi.com/Ther/Automotones.html) show how common these images were: self-moving tripods, mechanical attendants, and artificial servants made by a divine craftsperson. Golem traditions carry a related anxiety. Amir Vudka's essay on [the golem in the age of artificial intelligence](https://necsus-ejms.org/the-golem-in-the-age-of-artificial-intelligence/) describes a tradition where an artificial servant can protect a community and become dangerous when human control fails. These stories are old, but the worry is familiar: a tool that moves by itself can help us, extend us, and escape the simple category of a tool held in the hand.

<!-- phil-passage-id: ch13-p0013 -->
The old stories imagine helpers that move by themselves. Modern automation adds sensors, targets, feedback, institutional deployment, and scale. That difference matters. A mythic automaton may dramatize control anxiety, but a workplace robot or AI agent changes real workflows, incentives, skills, and responsibility structures.

<!-- phil-passage-id: ch13-p0014 -->
Industrial machinery made that change practical. In *Capital*, Marx's chapter on [machinery and large-scale industry](https://www.marxists.org/archive/marx/works/1867-c1/ch15.htm) distinguishes the tool from the machine system. A hand tool extends the worker's activity. A machine can absorb and reorganize that activity. The worker may still operate the system, while the machine sets pace, motion, rhythm, and dependence. Paul Adler's essay on [Marx, machines, and skill](https://faculty.marshall.usc.edu/Paul-Adler/research/Marx%2C%20machines%2C%20and%20skill.pdf) is useful because it keeps skill at the center. Automation often changes the worker's relation to the task. It changes what the worker must know, what the worker repeats, what the worker controls, and what the worker can contest.

<!-- phil-passage-id: ch13-p0015 -->
The twentieth century gave this problem a new technical language: cybernetics. Norbert Wiener's [*Cybernetics*](https://mitpress.mit.edu/9780262730099/cybernetics/) studied control and communication in animals and machines. W. Ross Ashby's [*Introduction to Cybernetics*](http://pespmc1.vub.ac.be/ASHBBOOK.html) helped formalize how systems regulate themselves through feedback. A thermostat is a simple example. It senses temperature, compares it to a target, and acts until the room moves closer to the target. More complex systems use richer sensors, models, goals, and adjustment loops, but cybernetic control still depends on signals, comparison, action, feedback, and adjustment.

<!-- phil-passage-id: ch13-p0016 -->
Cybernetics also produced ethical warnings. In ["Some Moral and Technical Consequences of Automation"](https://www.science.org/doi/10.1126/science.131.3410.1355), Wiener warned that machines can pursue specified goals with dangerous literalness. A system may do what it was told while missing the broader human purpose behind the instruction. This is one reason stories like the sorcerer's apprentice remain useful. The broom becomes dangerous because it carries out a goal without the wider judgment needed to know when the goal has become destructive.

<!-- phil-passage-id: ch13-p0017 -->
None of this means delegation is suspicious by itself. Human beings are delegating creatures. We delegate memory to notebooks and calendars. We delegate transportation to roads, maps, engines, buses, and pilots. We delegate specialized judgment to doctors, mechanics, teachers, lawyers, committees, institutions, and trusted friends. We also delegate cognitive work to writing, diagrams, calculators, search engines, spreadsheets, library systems, and software. Evan Risko and Sam Gilbert call this kind of reliance [cognitive offloading](https://www.sciencedirect.com/science/article/abs/pii/S1364661316300985): we use the world to reduce the mental work we must carry internally.

<!-- phil-passage-id: ch13-p0018 -->
The ethical issue begins when delegation becomes a feedback-governed handoff. A notebook stores what I wrote. A calculator performs a calculation I know how to set up and check. A supervised driving system continuously senses, predicts, adjusts, and acts. A mobile warehouse robot moves through a workplace while people reorganize their own paths around it. A coding agent interprets a task, plans steps, changes files, and asks for approval after the work has moved. A research agent may search, rank, summarize, synthesize, and produce a report that already feels finished. The human remains in the activity, but the role has changed.

<!-- phil-passage-id: ch13-p0019 -->
That change gives this chapter its structure. We will move through four ethical stakes. First, **handoff**: what has moved into the system? Second, **control**: what is steering the loop? Third, **capacity**: what happens to human skill and practical wisdom? Fourth, **responsibility**: who can answer for the result? Then we will test those ideas with robotics and algorithmic management, and end with a delegated-action audit students can use in their own AI-assisted research.

<!-- phil-section-id: ch13-s002 -->
## Handoff: What Moved Into The System?

<!-- phil-passage-id: ch13-p0020 -->
Deirdre Mulligan and Helen Nissenbaum use the concept of [handoff](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3784839) to analyze what happens when one system component replaces another. In AI ethics, the important case is often a human-to-software handoff. A human task, function, judgment, or practice moves into a computational system.

<!-- phil-passage-id: ch13-p0021 -->
This sounds simple until we look closely at what a task contains. A task is rarely only an output. A teacher grading student work does not only produce a score. The teacher notices patterns, reads context, interprets effort, applies standards, remembers prior attempts, and decides how to respond. A nurse triaging messages does not only route a request. The nurse reads urgency, tone, history, risk, and the patient's likely next step. A student summarizing an article does not only produce a paragraph. The student learns what counts as the main claim, what evidence supports it, which terms are unfamiliar, and where confusion remains.

<!-- phil-passage-id: ch13-p0022 -->
Mulligan and Nissenbaum's handoff model is useful because it asks what else moved when the visible output moved. The system may preserve one function while transforming the practice around it. The output can look the same while authority, visibility, responsibility, opportunity for objection, and skill have shifted.

<!-- phil-passage-id: ch13-p0023 -->
Return to Tesla. The visible task is driving from one place to another. When FSD Supervised is active, some parts of that task move from continuous human performance into the car's sensors, models, and control system. The driver still has legal and practical responsibilities. The handoff changes the driver's activity. Driving becomes supervision, readiness, and intervention. The driver has to understand what the system is doing well enough to know when to distrust it.

<!-- phil-passage-id: ch13-p0024 -->
That is harder than it sounds. A person actively steering a car receives constant feedback through hands, feet, eyes, balance, sound, and traffic flow. A person supervising automation may receive less practice and less immediate feedback. The handoff changes the texture of attention. The person is still in the task, but not in the same way.

<!-- phil-passage-id: ch13-p0025 -->
The agentic research example works the same way. Suppose a student asks Copilot or ChatGPT to create a literature review on AI in nursing. The tool searches, summarizes, and drafts. The visible output may be better organized than the student's first attempt would have been. The handoff question asks whether the student gave the tool source discovery, reading, synthesis, citation judgment, field vocabulary, the first rough attempt, or the recognition of gaps. If the student cannot explain which sources were strong, which claims were uncertain, or why the final focus changed, the tool did more than help. It changed the student's relation to the knowledge.

<!-- phil-passage-id: ch13-p0026 -->
The coding-agent example gives the sharpest version. A developer assigns an issue. The agent reads the project, changes files, runs tests, and creates a pull request. A human review remains. The handoff question asks what the review is reviewing. Is the human reviewing a small suggestion the person already understands? Or is the human approving a chain of work the agent assembled across files, dependencies, tests, and assumptions? In the first case, the tool extends the person's action. In the second, the person may be reviewing after the core reasoning has already moved.

<!-- phil-passage-id: ch13-p0027 -->
Handoff does not condemn automation. It slows the judgment down. It asks students to identify the activity that moved. A handoff can be responsible when the new system preserves the values and capacities the task needs. It can also be reckless when the output remains visible while the human practices that made the output trustworthy disappear.

<!-- phil-passage-id: ch13-p0028 -->
This also explains why "AI is just a tool" is both true and incomplete. It is true because the system is not a moral person. The tool does not own the decision. It cannot carry the student's academic responsibility, the driver's duty of care, or the institution's obligation to design a fair process. People and organizations remain answerable. The incomplete part is the word "just." Some tools change the activity they enter. A pencil changes writing less than a word processor. A word processor changes writing less than a predictive system that finishes sentences, rewrites tone, suggests sources, and produces an outline before the writer has formed one.

<!-- phil-passage-id: ch13-p0029 -->
The handoff frame helps students avoid two weak reactions. The first weak reaction is panic: the system touched the work, so the work is ruined. The second is complacency: a human approved the result, so the handoff is fine. Handoff asks a better diagnostic question. Which human move moved into the system, and what did that move carry with it? If the moved activity included attention, interpretation, practice, contestation, or responsibility, then the ethical evaluation has to follow those things into the system.

<!-- phil-passage-id: ch13-p0030 -->
This is why the same AI use can be harmless in one context and damaging in another. A student asking AI to reformat a bibliography after checking every source has handed off a low-stakes formatting task. A student asking AI to choose the sources, infer the central debate, and write the synthesis has handed off much more of the intellectual work. A nurse using an AI draft as a time-saving starting point while reading the chart and correcting the message has a different handoff from a clinic that uses AI to push messages through an overloaded workflow where clinicians only skim. The same tool name tells us little. The handoff tells us what changed.

<!-- phil-passage-id: ch13-p0031 -->
<aside class="textbox shaded" role="note" aria-labelledby="framework-map-delegation-handoff">
<h3 id="framework-map-delegation-handoff">Framework Map: Delegation And Handoff</h3>
<p>A tool extends human action. Delegation gives part of an activity to another person, institution, or system. Automation performs parts of an activity through a machine process. Agentic handoff occurs when a system plans, acts, revises, or prepares decisions in ways that change what the human knows, practices, controls, or answers for.</p>
</aside>

<!-- phil-section-id: ch13-s003 -->
## Control: What Is Steering The Loop?

<!-- phil-passage-id: ch13-p0032 -->
Once a handoff occurs, the next question is control. What is steering the system?

<!-- phil-passage-id: ch13-p0033 -->
Cybernetics helps here because it treats control as an ongoing loop. A system senses something, compares it to a goal or target, acts, receives feedback, and adjusts. The loop can be simple or complex. In a supervised driving system, the car responds to lane markings, cameras, route instructions, nearby traffic, and driver commands. An AI research workflow may be steered by prompts, search rankings, source summaries, citation patterns, and user feedback. A coding agent may be steered by the issue text, repository files, error messages, tests, logs, comments, and pull-request review.

<!-- phil-passage-id: ch13-p0034 -->
Control has two meanings in this chapter. **Causal control** asks what actually steers the system's behavior: sensors, rules, prompts, data, tests, metrics, models, rankings, rewards, feedback, and constraints. **Moral control** asks who can understand, redirect, justify, and answer for what happens. Automation creates ethical trouble when causal steering moves into metrics and feedback while moral responsibility remains assigned to a human supervisor.

<!-- phil-passage-id: ch13-p0035 -->
Control becomes ethically interesting when the goal is a proxy. A proxy is a measurable stand-in for something richer. A thermostat uses temperature as a proxy for comfort. A search engine may use ranking signals as proxies for relevance. A school risk model may use attendance, grades, logins, or prior records as proxies for student need. A coding agent may treat passing tests as a proxy for correct code. A chatbot may treat fluent, confident prose as a proxy for a good answer unless the human forces better evidence into the loop.

<!-- phil-passage-id: ch13-p0036 -->
The proxy may be useful. It may also be thin. Safe driving includes lane position and judgment about weather, road conditions, other drivers, and the unexpected. Good research includes sources and an honest account of what the sources do not settle. Good code includes passing tests and also maintainability, security, readability, and fit with the larger system. Good student learning includes a finished submission and the memory, explanation, revision, and ownership that let the student use the learning later. When the proxy narrows the human good, the system can succeed on its own terms while failing the larger purpose.

<!-- phil-passage-id: ch13-p0037 -->
This is the ethical bite in Wiener's warning about literal machines. A feedback system can pursue a specified target with impressive consistency. The danger appears when the target fails to represent what humans actually care about. If the instruction is "maximize engagement," the system may learn to recommend material that keeps attention while corroding trust, patience, or public reasoning. If the instruction is "produce a convincing research overview," the system may produce confident synthesis while hiding weak sources. If the instruction is "fix the bug," a coding agent may patch the visible failure while adding fragility elsewhere.

<!-- phil-passage-id: ch13-p0038 -->
Control also changes because agentic systems can iterate. The OECD working paper [*The Agentic AI Landscape and Its Conceptual Foundations*](https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/02/the-agentic-ai-landscape-and-its-conceptual-foundations_a9d4b451/396cf758-en.pdf) describes AI agents as systems that can perceive and act upon an environment with some degree of autonomy, use tools as needed, and adapt to changing inputs and contexts. The paper distinguishes that from more complex agentic AI systems that may coordinate multiple agents, decompose tasks, delegate subtasks, operate over time, and function in less predictable environments with limited human supervision. The final output is only one piece of the ethical record. The path matters: which tools were used, which sources were retrieved, which intermediate decisions were made, which errors were hidden, and which signals caused the system to adjust.

<!-- phil-passage-id: ch13-p0039 -->
A student can feel this difference immediately. Asking a chatbot, "What is cybernetics?" produces an answer. Asking a research-enabled tool to "build a literature review on AI and nursing workflow" starts a sequence. The tool may choose sources, summarize abstracts, group themes, omit weaker material, draft a synthesis, and revise when prompted. If the student cannot see why one source was chosen over another, the finished answer hides the loop. If the student asks the tool to explain its source choices, checks one source directly, and revises the question after seeing a gap, the student begins to steer the loop. The same technology supports different forms of control depending on what the human does inside the process.

<!-- phil-passage-id: ch13-p0040 -->
This is also where consequentialist reasoning can enter carefully. Consequences matter because automation changes outcomes, error patterns, and who bears risk. A narrow consequentialist argument might say: if the automated system produces better outcomes overall, use it. The control section complicates that argument by asking how "better" is being measured. A system may reduce average response time while increasing hidden error. It may improve short-term productivity while increasing later repair. It may help most users while making contestation harder for the people it misclassifies. Consequences still matter, but the feedback loop decides which consequences are counted.

<!-- phil-passage-id: ch13-p0041 -->
In the Tesla case, the driver is told to supervise the loop. But the loop is not visible in the way a steering wheel is visible. The driver sees a simplified representation of what the system seems to see and what the car is doing. The driver may not know exactly how the system classified a construction zone, anticipated a pedestrian, or weighted a lane marking. Human control depends on a partial interface into a much more complex loop.

<!-- phil-passage-id: ch13-p0042 -->
In an AI-assisted research report, the same problem appears in another form. The student sees a finished paragraph. The paragraph may contain sources, themes, and claims. The student often does not see how the tool ranked sources, which weak sources it ignored, which important terms it missed, or whether it treated common claims as stronger than they are. If the student never opens the sources, the feedback loop is steered by the tool's own proxies for quality and by the student's prompt. The student may be approving a report without understanding the loop that produced it.

<!-- phil-passage-id: ch13-p0043 -->
The control question has two parts. First, what goal or proxy is the system pursuing? Second, who can notice when that proxy is too thin? A human in the loop helps only when the human can see, understand, question, and redirect the loop. Approval after the fact is weak control when the person approving the output cannot reconstruct how the system got there.

<!-- phil-passage-id: ch13-p0044 -->
<aside class="textbox shaded" role="note" aria-labelledby="key-point-control-button">
<h3 id="key-point-control-button">Key Point: Control Requires More Than A Button</h3>
<p>Control is meaningful only when someone can understand what is being optimized, notice when the proxy is too thin, and redirect the system before the harm becomes merely something to document.</p>
</aside>

<!-- phil-section-id: ch13-s004 -->
## Capacity: What Happens To Skill And Practical Wisdom?

<!-- phil-passage-id: ch13-p0045 -->
The third ethical stake is capacity. Automation changes what people practice.

<!-- phil-passage-id: ch13-p0046 -->
Lisanne Bainbridge's classic article ["Ironies of Automation"](https://doi.org/10.1016/0005-1098(83)90046-8) explains a central problem in human factors research. Automation often removes the routine parts of a task and leaves humans with monitoring, diagnosis, takeover, and recovery. Those remaining tasks can be the hardest ones for humans to perform. Passive monitoring is difficult. Rare failures are difficult to anticipate. When automation works most of the time, the human may lose the practice needed for the moment when automation fails.

<!-- phil-passage-id: ch13-p0047 -->
Supervised driving changes the driver's activity. Active driving trains perception, timing, steering, braking, and the habit of reading traffic. Supervising automation trains a different habit: watching a system that usually seems competent. The driver may still be legally responsible, but responsibility now depends on attention and skill that the system may be quietly weakening. If the car suddenly needs the driver, the question becomes whether the driver has enough situation awareness and recent practice to act well.

<!-- phil-passage-id: ch13-p0048 -->
Human-factors researchers often describe related problems under headings such as automation bias, overreliance, misuse, disuse, and abuse. Raja Parasuraman and Victor Riley's article ["Humans and Automation"](https://doi.org/10.1518/001872097778543886) is a standard anchor for this vocabulary. People can over-trust automated recommendations. They can also under-trust useful automation after a failure. They may use a system outside its proper range, avoid a system that would help, or rely on it in ways that weaken attention. For designers and users, automation changes the human task. Placing a person near the system does not by itself preserve competent judgment.

<!-- phil-passage-id: ch13-p0049 -->
Driving research makes this concrete. A 2022 *Scientific Reports* article on [drivers of partially automated vehicles](https://www.nature.com/articles/s41598-022-19876-0) argues that automation can affect vigilance and takeover ability, especially when response time is short. A related review of the ["out-of-the-loop" concept in automated driving](https://link.springer.com/article/10.1007/s10111-018-0525-8) connects the problem to the driver's information processing, response capability, and ability to intervene. The important claim for this chapter is modest: a person can remain formally responsible while the system has changed the conditions under which competent intervention is possible.

<!-- phil-passage-id: ch13-p0050 -->
The same problem appears with intellectual skills. Students often experience AI as a way to remove friction. The tool can summarize a reading, generate a research question, draft a paragraph, identify themes, or produce a first version of an argument. Those uses may help. Some friction is wasted effort. A student should not have to spend two hours formatting a citation if the purpose of the task is ethical reasoning. Yet some friction is practice. Retrieval, explanation, source checking, revision, and error correction are part of how understanding forms.

<!-- phil-passage-id: ch13-p0051 -->
Learning science gives this point a strong base. Elizabeth and Robert Bjork describe [desirable difficulties](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf): conditions that can feel harder in the moment while improving long-term learning. Jeffrey Karpicke and Henry Roediger's work on [retrieval practice](https://pubmed.ncbi.nlm.nih.gov/18276894/) shows that pulling knowledge from memory can build learning more effectively than simply reviewing material. These findings do not mean all AI help is harmful. They show why ease cannot be the only measure. A tool that makes the product easier may remove the practice the student needed.

<!-- phil-passage-id: ch13-p0052 -->
This is where Shannon Vallor's work becomes central. In ["Moral Deskilling and Upskilling in a New Machine Age"](https://scholarcommons.scu.edu/phi/7/), Vallor argues that technologies can weaken or strengthen moral capacities depending on how they shape attention, practice, responsibility, and agency. Her broader work on technomoral wisdom adapts an older virtue-ethics idea to technological life. In the course's earlier chapter on [Aristotle and virtue ethics](/chapter/aristotle-character-and-ai-assisted-life/), practical wisdom is the cultivated ability to perceive what a situation calls for and to act well. Vallor's version asks how that kind of judgment survives when digital systems mediate more of our choices.

<!-- phil-passage-id: ch13-p0053 -->
Vallor asks what the tool trains. A system can deskill us when it removes occasions to notice, deliberate, explain, remember, repair, and take responsibility. A system can upskill us when it helps us see patterns, receive feedback, slow down, compare options, and practice better judgment. The same category of tool can do either, depending on how it is used and designed.

<!-- phil-passage-id: ch13-p0054 -->
That virtue-ethics angle changes the chapter. If we evaluate automation only by speed, accuracy, or productivity, the human being becomes a bottleneck to minimize. Virtue ethics asks what kind of person a practice is forming. Are students becoming more attentive readers, more careful source users, better explainers, more patient revisers, and more honest reasoners? Are workers becoming better at diagnosing systems, seeing limits, and taking responsibility? Or are they becoming people who can approve finished products without understanding the path that produced them?

<!-- phil-passage-id: ch13-p0055 -->
Support and interference depend on what AI use does to practice. A student who uses AI to quiz themselves after reading may be building retrieval and explanation. A student who uses AI to replace reading may be bypassing the same capacities. A developer who asks an agent to explain legacy code before making a change may be increasing understanding. A developer who accepts a large generated patch without reading it may be trading understanding for throughput. The moral difference lies in what happens to skill.

<!-- phil-passage-id: ch13-p0056 -->
Consider two students beginning a research project with AI. One asks for a report, skims the result, and copies the best-looking claims into a slide deck. That student may have a finished product but has not practiced the intellectual skills the research requires. The other asks for a starting map, chooses one claim, opens a source, checks whether the source supports the claim, revises the focus, and writes a short note about what the AI got wrong or missed. Both students used AI. The second kept practice inside the process.

<!-- phil-passage-id: ch13-p0057 -->
Recent research on generative AI and learning supports this caution, though it should not be overstated. Hao-Ping Lee and colleagues' 2025 study on [generative AI and critical thinking](https://www.microsoft.com/en-us/research/publication/the-impact-of-generative-ai-on-critical-thinking-self-reported-reductions-in-cognitive-effort-and-confidence-effects-from-a-survey-of-knowledge-workers/) reports that knowledge workers often experience critical thinking as shifting toward verification, integration, and task stewardship when AI is involved. Studies such as Ali Darvishi and colleagues' work on [AI assistance and student agency](https://www.sciencedirect.com/science/article/pii/S0360131523002440) and Yizhou Fan and colleagues' work on [metacognitive laziness](https://bera-journals.onlinelibrary.wiley.com/doi/10.1111/bjet.13544) point toward a similar concern: assistance can improve immediate performance while weakening monitoring, agency, or learning if the human stops practicing the skills those activities require.

<!-- phil-passage-id: ch13-p0058 -->
This gives students a better standard than "AI helped" or "AI hurt." Ask what capacity the activity is supposed to build. If the purpose is brainstorming, AI might widen the student's starting points. If the purpose is source evaluation, the student still needs to check the source. If the purpose is argument construction, AI may help identify objections, but the student must still decide which premise to defend, revise, or abandon. If the purpose is learning course vocabulary, a chatbot explanation may help, but students still need retrieval practice and their own examples. The ethical question follows the pedagogical purpose.

<!-- phil-passage-id: ch13-p0059 -->
This point belongs in an ethics course because it changes the way we think about agency. Agency includes the freedom to choose and the capacity to participate intelligently in the action. A student who chooses a chatbot answer without understanding it has made a choice, but a thin one. A developer who approves code without understanding the risks has made a choice under weak agency. A driver who must take over after minutes of passive supervision may technically choose, but the choice depends on capacities the design may have eroded. Choice becomes agency when the person can understand, evaluate, and answer for the action.

<!-- phil-passage-id: ch13-p0060 -->
Capacity is the virtue-ethics center of this chapter. A person can be formally responsible while lacking the practiced capacity to supervise well. Drivers may be told to take over after losing the habit of active driving. Developers may be asked to review generated code even as they lose familiarity with the codebase. Students may be asked to explain a research report after skipping the reading, retrieval, and source judgment that would make explanation possible. Automation changes responsibility by changing the people who are supposed to be responsible.

<!-- phil-passage-id: ch13-p0061 -->
<aside class="textbox shaded" role="note" aria-labelledby="pause-work-is-practice">
<h3 id="pause-work-is-practice">Pause: Some Work Is Practice</h3>
<p>AI can reduce wasted effort. It can also remove the difficulty that builds skill. The capacity question asks what the human still practices: noticing, explaining, checking, revising, repairing, refusing, or taking responsibility.</p>
</aside>

<!-- phil-section-id: ch13-s005 -->
## Robots At Work: When Automation Organizes Human Labor

<!-- phil-passage-id: ch13-p0062 -->
The chapter title includes robotics because automation reaches bodies, workplaces, and movement. Robots make delegated judgment physical.

<!-- phil-passage-id: ch13-p0063 -->
NIOSH's overview of [robotics in the workplace](https://www.cdc.gov/niosh/robotics/about/index.html) explains the basic tension. Robots can perform dangerous or repetitive tasks, and they can improve safety by keeping people away from some hazards. But the increasing number and types of workplace robots also create a knowledge gap around human-robot interaction. NIOSH lists traditional industrial robots, professional service robots, mobile robots, drones, wearable robotics, and collaborative robots among the systems now appearing in workplaces. It also names hazards such as struck-by or caught-between injuries, crushing and trapping, slipping or tripping, electrical hazards, unexpected contact, distraction, and worker stress. OSHA's technical manual on [industrial robot systems and industrial robot system safety](https://www.osha.gov/otm/section-4-safety-hazards/chapter-4) gives the same point in a safety-engineering vocabulary: a robot application includes the manipulator, control system, end-effector, workpiece, workspace, safeguarding, maintenance practices, programming, and integration.

<!-- phil-passage-id: ch13-p0064 -->
The NIOSH and OSHA lists turn a robot into a work-system problem. A mobile robot in a warehouse may carry goods efficiently, but the ethical question includes the surrounding system: whether it sets the human pace through metrics, gives workers real authority to stop unsafe work, preserves human skill, and makes responsibility traceable when the workflow fails.

<!-- phil-passage-id: ch13-p0065 -->
Imagine a warehouse using mobile robots to move shelves or bins. The robots travel through marked zones, slow near people, and reroute around obstacles. Workers scan items, follow prompts, meet pick targets, and respond when something jams. The handoff is not only the physical carrying of goods. Routing, pacing, queueing, and exception handling may also move into the system. The worker may no longer decide which path makes sense, when to slow down, which task to prioritize, or how much local judgment to use. The system can make the work look organized while narrowing the worker's room for practical judgment.

<!-- phil-passage-id: ch13-p0066 -->
This is where robotics overlaps with **algorithmic management**. Alexandra Mateescu and Aiha Nguyen's Data & Society explainer [*Algorithmic Management in the Workplace*](https://datasociety.net/wp-content/uploads/2019/02/DS_Algorithmic_Management_Explainer.pdf) defines algorithmic management as a set of technological tools and techniques that structure the conditions of work and remotely manage workforces, often through worker data collection, surveillance, automated or semi-automated decision-making, performance metrics, ratings, nudges, and penalties. Min Kyung Lee, Daniel Kusbit, Evan Metsky, and Laura Dabbish's CHI paper ["Working with Machines"](https://doi.org/10.1145/2702123.2702548) helped popularize the term in their study of Uber and Lyft drivers being assigned, optimized, and evaluated through software algorithms and tracked data. The [EU Platform Work Directive](https://eur-lex.europa.eu/eli/dir/2024/2831/oj/eng) shows that this is now a legal and policy concern as well as an academic one. The directive says algorithmic systems increasingly replace functions usually performed by managers, such as allocating tasks, pricing assignments, determining schedules, giving instructions, evaluating work, providing incentives, or applying adverse treatment.

<!-- phil-passage-id: ch13-p0067 -->
That policy language can sound far away from robotics, but the connection is direct. In a warehouse, mobile robots may move shelves, packages, or parts while algorithmic management systems decide who works where, which task comes next, how quickly a worker should move, what counts as delay, and whether performance is acceptable. The physical workflow, pace, evaluation, and discipline then become parts of one automated work system.

<!-- phil-passage-id: ch13-p0068 -->
This is not automatically bad. Robots can reduce heavy lifting, keep workers away from toxic environments, support disabled workers, improve consistency, and free people from repetitive motion. Algorithmic systems can sometimes reveal workload problems, route people away from hazards, or help managers see patterns they would otherwise miss. The ethical question is where the benefits and burdens go. Does the system make work safer or simply faster? Does it give workers better information or only collect more information from them? Does it preserve discretion when local conditions matter? Can workers contest a score, task assignment, route, speed target, or automated discipline? Can someone stop the workflow when safety and human judgment require it?

<!-- phil-passage-id: ch13-p0069 -->
A simple robotics case shows why "human in the loop" is too weak. Suppose a collaborative robot arm works near a human technician. The robot slows when a person enters a zone. The technician can hit an emergency stop. Formally, a human remains nearby. But answerable control asks more. Who set the speed and separation limits? Who tested the sensor's blind spots? What happens during maintenance, when ordinary safety assumptions may not hold? Does the technician have authority to slow production without retaliation? If the robot's target is throughput, who ensures that the proxy does not outrank safety, fatigue, or judgment?

<!-- phil-passage-id: ch13-p0070 -->
The embodied case also sharpens care ethics. In education and health care, automation may affect relationships. In warehouse, delivery, manufacturing, and service work, automation affects bodies: walking paths, lifting, posture, rest, pace, attention, and stress. A care-ethical reading asks whether the system preserves responsiveness to vulnerable people in context. Workers, patients, and students are people with bodies, histories, roles, and needs for recognition, even when the automated workflow treats them as route points, delivery destinations, or completed assignments.

<!-- phil-passage-id: ch13-p0071 -->
Robotics therefore strengthens the chapter's central frame. The question is still delegated judgment. What moved into the system? What steers the loop? What capacities are trained or weakened? Who can answer for the result? The difference is that in robotics, the answer may involve physical injury, workload, pace, fatigue, and workplace dignity as well as information quality.

<!-- phil-passage-id: ch13-p0072 -->
<aside class="textbox examples" aria-labelledby="case-lens-warehouse-robotics">
<h3 id="case-lens-warehouse-robotics">Case Lens: Warehouse Robotics And Algorithmic Management</h3>
<p>A mobile robot may not directly evaluate a worker, and a scheduling algorithm may not physically touch anyone. Together they can still organize a workplace around automated movement, data collection, pace targets, exception handling, and performance scores. The ethical question becomes: what kind of work system did the machine help create?</p>
</aside>

<!-- phil-section-id: ch13-s006 -->
## Ethical Frameworks Inside The Chapter

<!-- phil-passage-id: ch13-p0073 -->
Different ethical frameworks enter the chapter at different points. Consequentialist reasoning asks what automation changes in outcomes, error patterns, safety, productivity, and who bears risk. Virtue ethics asks what capacities automation trains or weakens. Deontological and autonomy-based reasoning asks whether a person remains an agent who can understand and answer for the action. Care ethics asks whether automation preserves attention to vulnerable people in context. Institutional ethics follows responsibility through the whole system so the nearest human is not treated as the only answerable person.

<!-- phil-passage-id: ch13-p0074 -->
A layered analysis of AI in nursing might begin with consequences: does the system reduce charting time or medication errors? It should also ask virtue-ethics questions about clinical judgment, care-ethics questions about patient attention, autonomy questions about patient consent and clinician override, and institutional-responsibility questions about who answers when the workflow fails. These frameworks reveal several dimensions of the same delegated-action problem.

<!-- phil-section-id: ch13-s007 -->
## Responsibility: Who Can Answer For The Result?

<!-- phil-passage-id: ch13-p0075 -->
The strongest objection to this chapter begins with a blunt claim: AI agents are still tools. Humans choose them, prompt them, deploy them, approve their outputs, and benefit from them. Machines are not moral agents simply because the industry calls them "agents." Responsibility should remain with people and institutions.

<!-- phil-passage-id: ch13-p0076 -->
That objection is correct as far as it goes. We should not pretend that a car, chatbot, robot, or coding agent has moral responsibility in the way a person does. Calling software an "agent" can confuse the issue. The word may describe a system's ability to pursue tasks, use tools, and take steps toward goals. It does not make the system a moral person. If a student turns in work they cannot explain, the student cannot blame the chatbot. If a company deploys a harmful automated process, the company cannot blame "the algorithm" as if the system floated free of human choices.

<!-- phil-passage-id: ch13-p0077 -->
The objection fails when it treats formal human involvement as enough. A person may be named as supervisor while lacking real knowledge, time, authority, skill, or visibility. An institution may assign responsibility to a human role after designing the workflow so that role cannot exercise meaningful control. Responsibility remains human, but it may become structurally difficult to locate and fairly assign.

<!-- phil-passage-id: ch13-p0078 -->
Andreas Matthias's article ["The Responsibility Gap"](https://doi.org/10.1007/s10676-004-3422-1) gives one way to understand the difficulty. Ordinary responsibility often depends on control and foreseeability. If a person controls an action and can reasonably foresee its effects, responsibility is easier to assign. Learning systems can strain that link. Designers, operators, and users may not fully predict how the system will behave after deployment. Matthias's argument does not show that every AI failure creates a gap. It shows why adaptive systems can make the responsibility question harder than ordinary tool use.

<!-- phil-passage-id: ch13-p0079 -->
Helen Nissenbaum's ["Accountability in a Computerized Society"](https://nissenbaum.tech.cornell.edu/papers/accountability.pdf) explains another part of the problem. Computerized systems often involve many hands across design, purchase, use, maintenance, and regulation. When something goes wrong, each actor can point to another part of the chain: the software had a bug, the user misunderstood, the vendor warned about limitations, the organization failed to train staff, or the system was too complex. Human responsibility remains, but the structure makes it hard to trace.

<!-- phil-passage-id: ch13-p0080 -->
Those barriers also appear in ordinary student work. When a chatbot invents a citation, the platform may place verification on the user, the instructor may point to the AI policy, and the student may have disclosed the tool without keeping a source trail. The final responsibility still sits with the student who submitted the work, but the chain reveals why AI-supported work needs visible process evidence. Prompts, links, source checks, notes, and revisions give that responsibility a trail.

<!-- phil-passage-id: ch13-p0081 -->
The same pattern appears in organizations when speed pressure, vendor design, worker review, and future maintenance all belong to the same AI-assisted workflow. If the organization has no clear review procedure, no audit trail, and no protected time for correction, responsibility becomes easy to proclaim and hard to exercise. The organization can say that humans remained in control. The actual workflow may have made control too thin to bear that claim.

<!-- phil-passage-id: ch13-p0082 -->
Madeleine Clare Elish's ["Moral Crumple Zones"](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2757236) shows how that difficulty often resolves in practice. In a physical crash, a crumple zone absorbs force. In human-machine systems, the nearest human operator may absorb blame for a system-level failure. The human appears to be in control, so blame collapses there, even when design, training, workload, interface, incentives, and automation left that person with limited real control.

<!-- phil-passage-id: ch13-p0083 -->
Supervised automation depends on this distinction. A driver may be responsible for paying attention, but the design of the handoff still matters. Did the interface give enough information? Were the system's limits clear? Was takeover realistic? Did the workflow place the driver in a monitoring role that human beings perform poorly for long stretches of time? When those conditions are weak, blame may still find the driver because the driver is visible, even though visibility is weaker than control.

<!-- phil-passage-id: ch13-p0084 -->
The robotics case makes this even clearer. A technician may be blamed for entering a dangerous zone, a warehouse worker may be blamed for missing a pace target, or a clinician may be blamed for approving a bad AI-drafted message. Sometimes the person did make a negligent choice. But the ethical analysis cannot stop with the nearest human. It must ask how the interface, training, schedule, metrics, incentive system, staffing level, and safety design shaped the person's ability to act responsibly.

<!-- phil-passage-id: ch13-p0085 -->
The agentic research and coding case makes the same point in knowledge work. Imagine a coding agent creates a change that passes the available tests. The human reviewer approves it. Weeks later, the code creates a security problem or makes the system harder to maintain. Responsibility may involve the reviewer who approved the pull request, the team that chose the tool, the company that built the agent, the manager who pressured the team to move faster, the institution that treated passing tests as enough, and the future maintainer who inherits code no one fully understands.

<!-- phil-passage-id: ch13-p0086 -->
Software developers already have a name for one delayed cost: technical debt. Ward Cunningham introduced the metaphor, and Martin Fowler's explanation of [technical debt](https://martinfowler.com/bliki/TechnicalDebt.html) remains a common reference. A team may choose a quick solution because it needs to move fast. The code works now. Later, the team pays through bugs, fragility, maintenance burden, confusion, or slower future development. In machine learning systems, Sculley and colleagues' paper on [hidden technical debt](https://papers.nips.cc/paper_files/paper/2015/hash/86df7dcfd896fcaf2674f757a2463eba-Abstract.html) shows how complex dependencies and changing data can create long-term costs that are easy to underestimate.

<!-- phil-passage-id: ch13-p0087 -->
AI coding agents can add to technical debt because they can generate more work faster than teams can understand it. Research such as Perry and colleagues' study on [AI assistants and insecure code](https://arxiv.org/abs/2211.03622), Fu and colleagues' work on [security weaknesses in Copilot-generated code](https://arxiv.org/abs/2310.02059), and Liu and colleagues' preprint on [AI-authored commits](https://arxiv.org/html/2603.28592v2) should be read with care. These sources should not be treated as proof that AI code is generally worse than human code. They support a narrower claim: generated code can create delayed security, maintenance, or review obligations when humans trust it too quickly or cannot inspect it adequately.

<!-- phil-passage-id: ch13-p0088 -->
Three debt ideas are useful here, but they do not have the same status.

<!-- phil-passage-id: ch13-p0089 -->
<aside class="textbox shaded textbox--framework-map" role="note" aria-labelledby="framework-map-delegated-work-debt">
<h3 id="framework-map-delegated-work-debt">Framework Map: Three Kinds of Debt Created by Delegated Work</h3>
<dl>
<dt><strong>Technical debt</strong></dt>
<dd><strong>Status:</strong> Established software-engineering metaphor. <strong>Meaning:</strong> A quick solution creates later maintenance, reliability, security, or design costs.</dd>
<dt><strong>Cognitive debt</strong></dt>
<dd><strong>Status:</strong> Emerging practitioner/student-facing label. <strong>Meaning:</strong> A group has a finished artifact while human understanding behind it remains thin.</dd>
<dt><strong>Responsibility debt</strong></dt>
<dd><strong>Status:</strong> Chapter teaching term. <strong>Meaning:</strong> A handoff creates future obligations to explain, fix, defend, or repair a result after the knowledge trail has gone cold.</dd>
</dl>
</aside>

<!-- phil-passage-id: ch13-p0090 -->
Cognitive debt describes a familiar pattern. The term is less established than technical debt, so this chapter treats it as a useful label rather than settled scientific vocabulary. DX's discussion of [cognitive debt](https://getdx.com/blog/cognitive-debt-the-hidden-risk-in-ai-driven-software-development/) captures a problem many teams and students can recognize. A group may have a working artifact while human understanding behind it is thin. The report exists, but nobody knows which source carried the strongest evidence. The code passes tests, but nobody understands why the design is sound. The presentation looks polished, but the student cannot explain the reasoning.

<!-- phil-passage-id: ch13-p0091 -->
Responsibility debt extends the same pattern. The phrase is chapter language. It means that a handoff can create future obligations to explain, fix, defend, or repair a result after the knowledge trail has gone cold. A student who uses AI to produce a report without keeping prompts, source checks, and revision notes may create responsibility debt. A company that deploys agentic workflows without logs, tests, documentation, or accountable review may do the same. Someone later has to answer for a result whose production chain is difficult to reconstruct.

<!-- phil-passage-id: ch13-p0092 -->
Automation can also repay debt when it is bounded and supervised. Official workflow descriptions from [GitHub Copilot coding agent](https://github.blog/ai-and-ml/github-copilot/assigning-and-completing-issues-with-coding-agent-in-github-copilot/) and [Anthropic's Claude Code research](https://www.anthropic.com/research/claude-code-expertise) point to uses such as implementing bounded changes, running checks, documenting work, and keeping human expertise in the review loop. That evidence is mostly vendor-side and should not be treated as proof that agents generally improve software. The narrower point is enough: automation can sometimes help write tests, document confusing functions, refactor repetitive code, identify dead paths, explain an unfamiliar module, or expose hidden assumptions. A student can use AI to find possible sources, then use the source trail to sharpen the research question and verify one important claim. A driver-assistance system can support safer driving when the human understands its limits and remains engaged. A robot can reduce lifting or keep people away from toxic conditions. The ethical judgment asks where the cost goes, who can see it, and whether the system strengthens or weakens the human capacity to answer for the result.

<!-- phil-passage-id: ch13-p0093 -->
Automation can make work safer, faster, more accessible, and more consistent. It can help novices see possibilities they would have missed. It can help experts clear routine work so they can focus on harder judgment. It can reveal hidden patterns and create better records. Those benefits should stay in the analysis. The ethical problem arrives when the benefits are purchased by hiding the practice, judgment, maintenance, and accountability that make the result trustworthy. Students should ask what kind of help the automation gives, who can explain the result, and what costs may appear later.

<!-- phil-section-id: ch13-s008 -->
## Answerable Control

<!-- phil-passage-id: ch13-p0094 -->
If formal human review is too weak, what should replace it?

<!-- phil-passage-id: ch13-p0095 -->
Filippo Santoni de Sio and Jeroen van den Hoven offer one influential answer in their article on [meaningful human control over autonomous systems](https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2018.00015/full). They argue that meaningful control requires tracking and tracing. Tracking means the system's behavior remains responsive to relevant human reasons and facts. Tracing means outcomes can be connected back to humans who have the right knowledge, authority, information, and capacity to participate in responsibility.

<!-- phil-passage-id: ch13-p0096 -->
This account helps because it avoids a shallow version of human oversight. A human in the loop can be meaningful. A human in the loop can also be theater. If the human only clicks approve after the system has made the important moves, the control may be formal. If the human can understand the system's goal, inspect the evidence trail, contest the output, intervene when needed, and answer for the result, the control becomes more meaningful.

<!-- phil-passage-id: ch13-p0097 -->
<table class="shaded">
<caption>Conditions of answerable control</caption>
<thead>
<tr><th scope="col">Condition</th><th scope="col">Core question</th><th scope="col">Example failure</th></tr>
</thead>
<tbody>
<tr><th scope="row">Tracking</th><td>Does the system respond to the right human reasons, facts, values, and constraints?</td><td>A model optimizes speed while ignoring safety, equity, or source quality.</td></tr>
<tr><th scope="row">Tracing</th><td>Can the outcome be connected to humans with knowledge, authority, information, and responsibility?</td><td>Everyone approved a small piece, but no one can explain the whole chain.</td></tr>
<tr><th scope="row">Answerability</th><td>Can someone understand, contest, redirect, repair, stop, or refuse in practice?</td><td>Logs exist, but the reviewer has no time, power, or skill to use them.</td></tr>
</tbody>
</table>

<!-- phil-passage-id: ch13-p0098 -->
Ben Green's critique of policies requiring [human oversight of government algorithms](https://dl.acm.org/doi/10.1145/3461702.3462530) supports this warning. Human oversight is often invoked as a safeguard, but the actual human may lack the information, time, training, power, or institutional support needed to challenge the system. A person asked to oversee an automated decision can become a legitimacy layer, with little practical ability to check the system.

<!-- phil-passage-id: ch13-p0099 -->
Apply this to Tesla. Answerable control would require more than the driver's physical presence. The driver needs a clear understanding of the system's limits, enough attention to track the road, enough driving capacity to intervene, and an interface that supports timely action. The manufacturer and regulator also remain in the chain. The driver is not the only human whose choices matter. Meaningful control asks whether the whole arrangement makes human understanding and intervention realistic.

<!-- phil-passage-id: ch13-p0100 -->
Apply it to workplace robotics. Answerable control would require more than an emergency stop button or a safety training video. Workers need to know the robot's operating zones, limits, escalation process, and failure modes. They need protected authority to stop unsafe work. Managers need to treat safety and dignity as goals that shape throughput targets. Designers and integrators need to build hazard analysis, maintenance procedures, and incident reporting into the system.

<!-- phil-passage-id: ch13-p0101 -->
Apply it to algorithmic management. Answerable control would require workers or their representatives to understand what data is collected, how tasks are assigned, how pace is measured, how ratings or penalties are produced, and how a person can challenge errors. If a system manages work through opaque scores and automated nudges, human control is not restored merely because a manager can override the system in theory. The question is whether real people have access, time, standing, and protection to contest the automated loop.

<!-- phil-passage-id: ch13-p0102 -->
Tracking and tracing help students separate two questions that often get blurred. Tracking asks whether the system's behavior stays connected to relevant human reasons. For a driving system, the relevant reasons include safety, law, road conditions, other road users, and the driver's destination. For a research tool, the relevant reasons include the research question, source quality, field context, and the difference between evidence and speculation. For a workplace robot, the relevant reasons include safety, ergonomic burden, dignity, pace, and worker voice. Tracing asks whether the outcome can be connected back to humans who can answer for it. A tool may track a goal fairly well while still failing tracing because no human can explain the chain. Another tool may have logs and approvals while tracking the wrong goal.

<!-- phil-passage-id: ch13-p0103 -->
Apply it to agentic research. If a student uses AI to create a literature review, answerable control means the student can explain the search focus, identify at least one source they personally vetted, state what the AI got wrong or missed, and revise the final focus. Disclosure alone is not enough. A student can disclose AI use while still surrendering the judgment the assignment was meant to practice. The better standard is visible ownership: what the student asked, checked, revised, rejected, and can now explain.

<!-- phil-passage-id: ch13-p0104 -->
Apply it to coding agents. Answerable control means a reviewer has access to the prompt, plan, changed files, tests, logs, assumptions, and risks. It also means the reviewer has enough expertise and time to inspect the change. Branch protections, pull-request review, tests, documentation, and audit logs can help. They do not automatically solve the problem. A system can produce a neat trail that nobody reads well. A human review process can become meaningful only when the human role is matched with real knowledge, authority, and capacity.

<!-- phil-passage-id: ch13-p0105 -->
This is where answerable control differs from simple transparency. Transparency often means that information is available. Answerability asks whether the right person can use the information at the right moment. A hundred pages of logs may technically reveal what happened while still overwhelming the reviewer. A clear explanation may help, but only if it explains the decision at the level the human needs. A source list may look transparent while hiding the fact that none of the sources support the strongest claim. The ethical standard is practical: can someone understand enough to question, redirect, repair, or refuse?

<!-- phil-passage-id: ch13-p0106 -->
Answerable control also requires authority. A person who sees the problem but cannot act on it is not exercising meaningful control. A driver who cannot regain control quickly enough, a clinician who cannot correct an overloaded inbox workflow, a warehouse worker who cannot challenge an unsafe pace target, a worker who cannot contest an automated productivity score, and a student who cannot revise an AI-generated report all face different versions of the same problem. The system may expose enough information to make the weakness visible, while the person still lacks the power, time, or skill to intervene.

<!-- phil-passage-id: ch13-p0107 -->
The same framework transfers to other fields. In healthcare, an AI-drafted message may be reviewed by a clinician, but the ethical question is whether the clinician has enough context, time, and authority to correct the system. In education, an AI feedback tool may produce comments on student writing, but the teacher must know what the tool rewards and what it misses. In hiring, an automated screen may rank applicants, but humans must understand which signals drive the ranking and whether applicants can contest errors. In each case, the question is whether human control is answerable.

<!-- phil-passage-id: ch13-p0108 -->
This brings us back to practical wisdom. Meaningful human control is both a policy condition and a human-capacity condition. People cannot govern systems responsibly if they no longer practice the skills needed to understand, evaluate, repair, and challenge those systems. Vallor's account of technomoral wisdom and Santoni de Sio and van den Hoven's account of meaningful human control meet here: responsible systems need structures that preserve answerability, and responsible people need habits that make answerability possible.

<!-- phil-passage-id: ch13-p0109 -->
Good delegation keeps human purposes visible, leaves the feedback loop inspectable enough for correction, protects the skills needed for review, makes responsibility traceable to people and institutions with real authority, and allows people to use AI while preserving their own judgment.

<!-- phil-passage-id: ch13-p0110 -->
<aside class="textbox shaded" role="note" aria-labelledby="common-mistakes-delegated-judgment">
<h3 id="common-mistakes-delegated-judgment">Common Mistakes</h3>
<table class="shaded">
<caption>Common claims and better checks for delegated judgment</caption>
<thead>
<tr><th scope="col">Claim</th><th scope="col">What to check instead</th></tr>
</thead>
<tbody>
<tr><th scope="row">A human clicked approve.</th><td>Did the person understand enough to redirect, repair, or refuse?</td></tr>
<tr><th scope="row">The system is accurate on average.</th><td>Does the proxy fit the human purpose in this context?</td></tr>
<tr><th scope="row">The task got easier.</th><td>Did the person still practice the skill the task was meant to build?</td></tr>
<tr><th scope="row">The AI is an agent.</th><td>Which people or institutions remain answerable for the result?</td></tr>
<tr><th scope="row">The workflow has logs.</th><td>Can anyone actually use those logs in time to contest or repair the system?</td></tr>
</tbody>
</table>
</aside>

<!-- phil-section-id: ch13-s009 -->
## A Delegated-Action Audit

<!-- phil-passage-id: ch13-p0111 -->
The delegated-action audit works for personal AI-assisted work as well as self-driving cars, chatbots, coding agents, mobile robots, student-success models, automated hiring screens, medical triage systems, and algorithmic management systems.

<!-- phil-passage-id: ch13-p0112 -->
Start with the handoff. What activity moved into the system? Be specific. "It used AI" is too vague. Did the system search, rank, draft, summarize, decide, recommend, classify, route, monitor, assign, evaluate, discipline, or approve? Did it replace a first attempt, a final check, an expert review, a routine step, a safety judgment, or a management decision?

<!-- phil-passage-id: ch13-p0113 -->
Then ask what steered the loop. What goal, proxy, metric, signal, prompt, source, ranking, test, route, score, speed target, or feedback shaped the system's action? If you cannot tell what steered it, that is already part of your judgment.

<!-- phil-passage-id: ch13-p0114 -->
Next, ask what human capacity remained in practice. Did the human still observe, read, retrieve, explain, check, revise, debug, refuse, repair, or answer? Did the system help strengthen that capacity, or did it allow the human to skip it?

<!-- phil-passage-id: ch13-p0115 -->
Then ask what debt the handoff creates or repays. Does it create technical debt, cognitive debt, responsibility debt, maintenance burden, verification burden, safety burden, or future repair work? Does it repay debt by documenting, testing, simplifying, explaining, exposing hidden assumptions, reducing dangerous labor, or making a process easier to audit?

<!-- phil-passage-id: ch13-p0116 -->
Finally, ask who can answer for the result. Who has the knowledge, authority, information, skill, and intervention power needed to understand, contest, repair, or stop the system? If the answer is "someone technically approved it," keep going until you can name what that person could actually understand and change.

<!-- phil-passage-id: ch13-p0117 -->
<aside class="textbox exercises" aria-labelledby="try-it-delegated-action-audit">
<h3 id="try-it-delegated-action-audit">Try It: Delegated-Action Audit</h3>
<p>For an AI-assisted task, the audit can be short:</p>
<p>I handed off ______.</p>
<p>The system seemed to be steered by ______.</p>
<p>I kept ______ in my own hands so I could learn, verify, revise, or answer for it.</p>
<p>One debt or risk this created was ______.</p>
<p>One thing I checked, changed, rejected, or can explain myself is ______.</p>
</aside>

<!-- phil-passage-id: ch13-p0118 -->
Here is a completed student example:

<!-- phil-passage-id: ch13-p0119 -->
<aside class="textbox examples" aria-labelledby="worked-example-student-audit">
<h3 id="worked-example-student-audit">Worked Example: Student Audit</h3>
<p>I handed off first-pass source discovery and theme grouping for a research map on AI in nursing documentation.</p>
<p>The system seemed to be steered by my prompt, common search terms, source-ranking patterns, and the tool's tendency to summarize abstracts into broad themes.</p>
<p>I kept source evaluation and final focus in my own hands by opening two sources, checking whether they actually supported the strongest AI-generated claim, and narrowing my topic to clinician review of AI-drafted patient messages.</p>
<p>One debt or risk this created was cognitive debt: I could have had a polished map without understanding which source carried the real evidence.</p>
<p>One thing I checked, changed, rejected, or can explain myself is why I removed one source that looked relevant but discussed general digital health rather than delegated judgment in clinical workflow.</p>
</aside>

<!-- phil-passage-id: ch13-p0120 -->
Here is a workplace robotics example:

<!-- phil-passage-id: ch13-p0121 -->
<aside class="textbox examples" aria-labelledby="worked-example-workplace-robotics">
<h3 id="worked-example-workplace-robotics">Worked Example: Workplace Robotics</h3>
<p>The warehouse handed off route sequencing and pick pacing to a robot-and-software workflow.</p>
<p>The system seemed to be steered by throughput targets, scanner data, robot availability, item location, and real-time exception handling.</p>
<p>Workers kept some local judgment, but only if they had authority to pause, report hazards, question targets, and override unsafe instructions.</p>
<p>One debt or risk this created was responsibility debt: if an injury or repeated strain appeared later, the company would need to reconstruct how robot routing, pace targets, staffing, training, and management decisions interacted.</p>
<p>One thing the organization should be able to explain is who set the speed and safety thresholds, who reviewed incidents, and how workers can contest unsafe assignments without retaliation.</p>
</aside>

<!-- phil-passage-id: ch13-p0122 -->
The audit makes judgment visible. Humans always delegate, and ethical delegation preserves the understanding, practice, and responsibility that make human judgment possible.

<!-- phil-passage-id: ch13-p0123 -->
Responsible delegation depends on how a design distributes judgment, contestability, and accountability.

<!-- phil-passage-id: ch13-p0124 -->
<aside class="textbox shaded" role="note" aria-labelledby="build-like-philosopher">
<h3 id="build-like-philosopher">Build Like A Philosopher</h3>
<p>A responsible design asks what human judgment the result depends on, where that judgment now lives, what people still practice, who can contest the loop, and who can answer when the system fails.</p>
</aside>

<!-- phil-section-id: ch13-s010 -->
## References

<!-- phil-passage-id: ch13-p0125 -->
- Adler, Paul S. [Marx, machines, and skill](https://faculty.marshall.usc.edu/Paul-Adler/research/Marx%2C%20machines%2C%20and%20skill.pdf). Used as secondary support for the tool/machine/skill distinction.
- Alphabet. (2025). [2025 Q1 Earnings Call](https://abc.xyz/investor/events/event-details/2025/2025-Q1-Earnings-Call/). Used for official Google/Alphabet language about checked-in code involving accepted AI-suggested solutions. Retained as scale context, with caution against overstating the claim.
- Anthropic. (2026). [Agentic coding and persistent returns to expertise](https://www.anthropic.com/research/claude-code-expertise). Used for current Claude Code / agentic coding practice and the continuing role of expertise.
- Anthropic. (2026). [When AI builds itself](https://www.anthropic.com/institute/recursive-self-improvement). Used for Anthropic's official claims about AI-authored code, recursive self-improvement pressure, and human direction/review caveats.
- Aranda, Luis, and Kasumi Sugimoto. (2026). [*The Agentic AI Landscape and Its Conceptual Foundations*](https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/02/the-agentic-ai-landscape-and-its-conceptual-foundations_a9d4b451/396cf758-en.pdf). OECD Artificial Intelligence Papers No. 56. Used for agent/agentic-AI terminology and features such as autonomy, tool use, task decomposition, delegation, sustained operation, and limited human supervision. Working paper; not treated as official OECD or member-country policy.
- Ashby, W. Ross. (1956). [*An Introduction to Cybernetics*](http://pespmc1.vub.ac.be/ASHBBOOK.html). Used as a cybernetics support source for regulation and feedback.
- Bainbridge, Lisanne. (1983). [Ironies of automation](https://doi.org/10.1016/0005-1098(83)90046-8). Used for the monitoring, intervention, and skill-maintenance problem under automation.
- Beckers, Niek, Luciano Cavalcante Siebert, Merijn Bruijnes, Catholijn Jonker, and David Abbink. (2022). [Drivers of partially automated vehicles are blamed for crashes that they cannot reasonably avoid](https://www.nature.com/articles/s41598-022-19876-0). *Scientific Reports*, 12, Article 16193. Used for partially automated driving, takeover ability, and responsibility-attribution concerns.
- Bjork, Elizabeth L., and Bjork, Robert A. (2011). [Creating desirable difficulties to enhance learning](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf). Used for the distinction between easy performance and durable learning.
- CDC / NIOSH. (2024). [Robotics in the workplace: An overview](https://www.cdc.gov/niosh/robotics/about/index.html). Used for workplace robotics types, benefits, hazards, and the human-robot-interaction knowledge gap.
- AI & Ethics interactive textbook. [Aristotle and the origins of Western virtue ethics](/chapter/aristotle-character-and-ai-assisted-life/). Used as a course cross-reference for practical wisdom.
- Darvishi, Ali, et al. (2023). [Impact of AI assistance on student agency](https://www.sciencedirect.com/science/article/pii/S0360131523002440). Used for student agency concerns under AI assistance.
- Elish, Madeleine Clare. (2019). [Moral crumple zones: Cautionary tales in human-robot interaction](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2757236). Used for blame concentration in human-machine systems.
- European Parliament and Council of the European Union. (2024). [Directive (EU) 2024/2831 on improving working conditions in platform work](https://eur-lex.europa.eu/eli/dir/2024/2831/oj/eng). Used for contemporary legal framing of algorithmic management, automated monitoring, automated decision-making, explanation, human review, and contestability in platform work.
- Fan, Yizhou, et al. (2025). [Beware of metacognitive laziness](https://bera-journals.onlinelibrary.wiley.com/doi/10.1111/bjet.13544). Used cautiously for metacognition and AI-assisted learning concerns.
- Fowler, Martin. (2003). [Technical debt](https://martinfowler.com/bliki/TechnicalDebt.html). Used for common software-practice explanation of technical debt.
- Fu, Yuxia, et al. (2023). [Security weaknesses of Copilot-generated code in GitHub projects](https://arxiv.org/abs/2310.02059). Used with caveats for security and review risk in AI-generated code.
- GitHub. (2025). [Assigning and completing issues with coding agent in GitHub Copilot](https://github.blog/ai-and-ml/github-copilot/assigning-and-completing-issues-with-coding-agent-in-github-copilot/). Used for official coding-agent workflow mechanics.
- Google. [Jules](https://jules.google/). Used for official asynchronous coding-agent workflow mechanics.
- Green, Ben. (2021). [The flaws of policies requiring human oversight of government algorithms](https://dl.acm.org/doi/10.1145/3461702.3462530). Used for critique of checkbox-style human oversight.
- Karpicke, Jeffrey D., and Roediger, Henry L. III. (2008). [The critical importance of retrieval for learning](https://pubmed.ncbi.nlm.nih.gov/18276894/). Used for retrieval practice and durable learning.
- Lee, Hao-Ping, et al. (2025). [The impact of generative AI on critical thinking](https://www.microsoft.com/en-us/research/publication/the-impact-of-generative-ai-on-critical-thinking-self-reported-reductions-in-cognitive-effort-and-confidence-effects-from-a-survey-of-knowledge-workers/). Used for self-reported shifts in critical-thinking effort, verification, integration, and task stewardship.
- Lee, Min Kyung, Daniel Kusbit, Evan Metsky, and Laura Dabbish. (2015). [Working with machines: The impact of algorithmic and data-driven management on human workers](https://doi.org/10.1145/2702123.2702548). Used as an anchor for algorithmic management in ridehail work.
- Liu, et al. (2026). [Debt behind the AI boom](https://arxiv.org/html/2603.28592v2). Used as a preprint/static-analysis source for possible delayed costs in AI-authored commits. It is not used to claim that AI code is generally worse.
- Marx, Karl. (1867). [*Capital*, Volume I, Chapter 15: Machinery and Large-Scale Industry](https://www.marxists.org/archive/marx/works/1867-c1/ch15.htm). Used for the compact tool/machine distinction in the automation genealogy.
- Mateescu, Alexandra, and Aiha Nguyen. (2019). [*Algorithmic Management in the Workplace*](https://datasociety.net/wp-content/uploads/2019/02/DS_Algorithmic_Management_Explainer.pdf). Data & Society. Used for workplace algorithmic-management definitions, features, and worker-rights concerns.
- Matthias, Andreas. (2004). [The responsibility gap](https://doi.org/10.1007/s10676-004-3422-1). Used for control and foreseeability problems in learning systems.
- Mayor, Adrienne / Stanford News. (2019). [Ancient myths reveal early fantasies of artificial life](https://news.stanford.edu/stories/2019/02/ancient-myths-reveal-early-fantasies-artificial-life). Used for compact genealogy of artificial helpers and automata.
- Merat, Natasha, Bobbie Seppelt, Tyron Louw, et al. (2019). [The "out-of-the-loop" concept in automated driving](https://link.springer.com/article/10.1007/s10111-018-0525-8). *Cognition, Technology & Work*, 21, 87-98. Used for automated-driving vigilance and intervention-capacity framing.
- Mulligan, Deirdre K., and Nissenbaum, Helen. (2020). [The concept of handoff as a model for ethical analysis and design](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3784839). In Markus D. Dubber, Frank Pasquale, and Sunit Das (Eds.), *The Oxford Handbook of Ethics of AI*. Used as the central handoff framework.
- National Highway Traffic Safety Administration. [Automated vehicles for safety](https://www.nhtsa.gov/vehicle-safety/automated-vehicles-safety). Used for general federal public-facing framing of current automated-vehicle safety and driver engagement.
- Nissenbaum, Helen. (1996). [Accountability in a computerized society](https://nissenbaum.tech.cornell.edu/papers/accountability.pdf). Used for accountability barriers.
- Occupational Safety and Health Administration. [Industrial robot systems and industrial robot system safety](https://www.osha.gov/otm/section-4-safety-hazards/chapter-4). OSHA Technical Manual, Section IV, Chapter 4. Used for robot-system components, hazards, and safety framing.
- OpenAI. (2025). [Codex cloud documentation](https://developers.openai.com/codex/cloud). Used for official coding-agent workflow mechanics.
- Parasuraman, Raja, and Riley, Victor. (1997). [Humans and automation: Use, misuse, disuse, abuse](https://doi.org/10.1518/001872097778543886). Used for automation-bias and human-factors vocabulary.
- Perry, Neil, et al. (2022). [Do users write more insecure code with AI assistants?](https://arxiv.org/abs/2211.03622). Used with caveats for AI assistance, trust, and code security.
- Risko, Evan F., and Gilbert, Sam J. (2016). [Cognitive offloading](https://www.sciencedirect.com/science/article/abs/pii/S1364661316300985). Used to frame cognitive offloading as a normal human strategy.
- Santoni de Sio, Filippo, and van den Hoven, Jeroen. (2018). [Meaningful human control over autonomous systems](https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2018.00015/full). Used for tracking and tracing.
- Sculley, D., et al. (2015). [Hidden technical debt in machine learning systems](https://papers.nips.cc/paper_files/paper/2015/hash/86df7dcfd896fcaf2674f757a2463eba-Abstract.html). Used for hidden technical debt in AI/ML systems.
- Storey, Margaret-Anne / DX. (2026). [Cognitive debt: The hidden risk in AI-driven software development](https://getdx.com/blog/cognitive-debt-the-hidden-risk-in-ai-driven-software-development/). Used as practitioner framing for cognitive debt, with caveat that the term is emerging.
- Tesla. [Full Self-Driving (Supervised)](https://www.tesla.com/support/fsd). Used for official Tesla framing of FSD Supervised.
- Tesla. [Full Self-Driving (Supervised) owner manual](https://www.tesla.com/ownersmanual/model3/en_us/GUID-2CB60804-9CEA-4F4B-8B04-09B991368DC5.html). Used for driver attention and takeover language.
- Theoi. [Automotones](https://www.theoi.com/Ther/Automotones.html). Used for classical-source examples of Hephaestus's automata.
- Vallor, Shannon. (2015). [Moral deskilling and upskilling in a new machine age](https://scholarcommons.scu.edu/phi/7/). Used for moral skill, deskilling, upskilling, and technomoral judgment.
- Vudka, Amir. [The golem in the age of artificial intelligence](https://necsus-ejms.org/the-golem-in-the-age-of-artificial-intelligence/). Used for compact golem/control genealogy.
- Wiener, Norbert. (1948). [*Cybernetics: Or Control and Communication in the Animal and the Machine*](https://mitpress.mit.edu/9780262730099/cybernetics/). Used for cybernetics and feedback-control framing.
- Wiener, Norbert. (1960). [Some moral and technical consequences of automation](https://www.science.org/doi/10.1126/science.131.3410.1355). Used for cybernetic goal pursuit and automation ethics.
