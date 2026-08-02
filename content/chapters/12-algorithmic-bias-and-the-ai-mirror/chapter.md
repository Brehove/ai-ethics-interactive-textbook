# Algorithmic Bias and the AI Mirror: When Prediction Becomes an Opportunity Gate

<!-- phil-section-id: ch12-s001 -->
## The Dashboard That Decides Who Gets Noticed

<!-- phil-passage-id: ch12-p0001 -->
An adviser at a community college opens a student-success dashboard on Monday morning. Each student appears next to a color-coded risk score built by an AI system trained on years of grades, financial-aid patterns, attendance logs, advising notes, and clickstream data from the learning management system. The adviser cares about her students and has only a few hours for outreach before the rest of the day fills with appointments. She lets the top of the list guide her afternoon calls.

<!-- phil-passage-id: ch12-p0002 -->
Diego is on the list. He is a first-generation student who works a night shift at a warehouse, does much of his reading on paper, uses a shared laptop at home, and logs into the LMS in short bursts around childcare. The system reads his sparse logins as low engagement, tags him high risk, and moves him to the top of the outreach queue. Kai is not on the list. She works from a laptop at home, logs in constantly, and looks like a strong-signal student on every measurable variable. She is also close to a breakdown. Nothing in the data the dashboard reads can see that.

<!-- phil-passage-id: ch12-p0003 -->
This is a composite classroom case, not a claim about any particular CWI system. Its purpose is to make the ethical structure visible. The dashboard is doing something institutions often want to do: predict who might need help. The intention behind it is good. Colleges want to catch students before they drop out and offer attention early. Predictive systems like this one appear in education, credit, hiring, health care, benefits administration, criminal justice, content moderation, insurance, workplace management, and government services. Institutional decisions once made slowly by individual judgment are increasingly filtered through systems that score, sort, rank, recommend, or warn.

<!-- phil-passage-id: ch12-p0004 -->
Wanting to help earlier is a legitimate institutional goal. The question this chapter asks is when that help becomes gatekeeping. The dashboard describes the world and decides something inside it. It sends attention toward some students and away from others. It flags some, warns some, and quietly leaves the rest alone. It shapes the flow of a scarce resource.

<!-- phil-passage-id: ch12-p0005 -->
The dashboard can also be wrong in more than one way. Diego may receive **misdirected attention**: the system notices him, but under the wrong description, as if his life constraints were evidence of disengagement. Kai may receive **missing attention**: the system misses her because the distress that matters does not appear in the features it measures. Diego shows a distorted positive. Kai shows a false negative. Together they show why algorithmic bias is not only about whether a model is “accurate overall.” It is about what the system sees, what it misses, how it describes people, who bears error, and what the institution does next.

<!-- phil-passage-id: ch12-p0006 -->
Algorithmic bias becomes a philosophical problem when an accurate model distributes opportunity, errors, or power unjustly. A model can be accurate about the average case and still be ethically defective in how it treats particular people, how it distributes opportunity over time, whose errors it hides, and whether the people it labels can answer back. In PHIL 123, students should name the wrong at stake, support the diagnosis with evidence, and identify a repair that addresses it.

<!-- phil-passage-id: ch12-p0007 -->
<aside class="textbox shaded" role="note" aria-labelledby="key-point-prediction-gate">
<h3 id="key-point-prediction-gate">Key Point: Prediction Becomes Ethical When It Becomes A Gate</h3>
<p>A prediction becomes ethically serious when an institution uses it to allocate attention, money, work, care, credibility, discipline, opportunity, or risk. The more important the gate, the more careful the ethical diagnosis has to be.</p>
</aside>

<!-- phil-section-id: ch12-s002 -->
## What Algorithms And Bias Mean Here

<!-- phil-passage-id: ch12-p0008 -->
Before the chapter can use Shannon Vallor’s mirror metaphor, the terms need care.

<!-- phil-passage-id: ch12-p0009 -->
An **algorithm**, in this chapter, is a repeatable computational process that turns inputs into outputs such as scores, classifications, recommendations, rankings, or generated answers. Older algorithms could be hand-coded. Many current AI systems learn patterns from examples. A model is trained on data, finds relationships, and then applies those relationships to new cases. That is why a student-success dashboard, a credit score, a hiring screen, a content-moderation classifier, a medical risk model, and a chatbot can all belong in the same ethical conversation even though they look different on the surface.

<!-- phil-passage-id: ch12-p0010 -->
**Bias** means something more specific than personal preference. Here, bias is a systematic tilt in how a system sees, measures, classifies, recommends, or acts. The [NIST report on bias in AI](https://www.nist.gov/publications/towards-standard-identifying-and-managing-bias-artificial-intelligence) describes a world where ambiguous human behavior is captured, quantified, categorized, sorted, recommended, and used to make decisions about people’s lives. NIST’s central warning is sociotechnical: harmful bias can remain endemic across technology processes and can cause harm regardless of whether anyone intended to discriminate.

<!-- phil-passage-id: ch12-p0011 -->
**Algorithmic bias** happens when computational sorting carries that systematic tilt into consequential treatment. It can misrepresent a person, distribute errors unevenly, restrict opportunity, hide a worldview or political assumption inside a technical rule, or make the past look like objective evidence about the future. Bias can involve race, gender, class, region, disability, language, religion, politics, accent, age, immigration status, credit history, work schedule, family structure, device access, or broader worldview. Any of those can become a proxy, a classification, an error burden, or a hidden rule that shapes access to a good.

<!-- phil-passage-id: ch12-p0012 -->
The [Stanford Encyclopedia of Philosophy entry on algorithmic fairness](https://plato.stanford.edu/entries/algorithmic-fairness/) is useful because it treats algorithmic fairness as a contested moral question, not merely a technical score. Technical measures matter. But the moral dispute is about what fairness requires in a particular context. Some fairness questions compare how groups are treated. Others ask whether a person was treated as they should have been treated at all.

<!-- phil-passage-id: ch12-p0013 -->
Here is the chapter’s basic map:

<!-- phil-passage-id: ch12-p0014 -->
<table class="shaded">
<caption>Core concepts for diagnosing algorithmic bias</caption>
<thead>
<tr>
<th scope="col">Concept</th>
<th scope="col">Simple definition</th>
<th scope="col">Student question</th>
</tr>
</thead>
<tbody>
<tr>
<th scope="row">Mirror</th>
<td>The system reflects patterns in past data.</td>
<td>What record of the world is this model learning from?</td>
</tr>
<tr>
<th scope="row">Gate</th>
<td>The system helps allocate a scarce good.</td>
<td>What opportunity, support, burden, or risk is being distributed?</td>
</tr>
<tr>
<th scope="row">Proxy</th>
<td>The system measures one thing as a stand-in for another.</td>
<td>What human concern has been replaced by measurable data?</td>
</tr>
<tr>
<th scope="row">Error burden</th>
<td>Mistakes are not distributed equally.</td>
<td>Who bears false positives, false negatives, delays, denials, or extra scrutiny?</td>
</tr>
<tr>
<th scope="row">Contestability</th>
<td>Affected people can challenge the decision.</td>
<td>Can a person see, correct, appeal, or escape the system’s judgment?</td>
</tr>
<tr>
<th scope="row">Repair</th>
<td>The institution changes the system or refuses to use it.</td>
<td>Is the fix technical, procedural, institutional, structural, or a refusal to automate?</td>
</tr>
</tbody>
</table>

<!-- phil-passage-id: ch12-p0015 -->
This chapter builds toward a **Bias Judgment Audit**, a short routine for examining an algorithmic system. To build like a philosopher, you do not merely ask whether a system works. You ask what it is for, what it assumes, whom it burdens, what kind of wrong it could produce, and what an institution would have to change to make the system answerable.

<!-- phil-section-id: ch12-s003 -->
## From Data Mirror To Opportunity Gate

<!-- phil-passage-id: ch12-p0016 -->
Shannon Vallor calls modern AI systems a kind of mirror. In [*The AI Mirror*](https://academic.oup.com/book/56292), she argues that machine-learning systems are trained on records of what human beings have already done, written, said, ranked, purchased, hired, arrested, treated, or ignored. The output looks like a fresh judgment. What it actually returns is a compressed reflection of past human and institutional behavior. The system does not know the world as a human participant knows it. It has learned patterns in how people and institutions have recorded the world.

<!-- phil-passage-id: ch12-p0017 -->
Vallor’s metaphor sharpens the usual claim that AI is trained on data. A mirror shows the room selectively. It reflects some things clearly, blurs others, distorts near the edges, and hides whatever is not standing in front of it. A dashboard trained on students who succeeded at the college in past years learns those students’ patterns of logging in, completing assignments, and asking for help. It learns less about the students who never enrolled, who dropped in the first two weeks, who paid for a semester and vanished, who succeeded through paths the college did not record, or who were discouraged by institutional practices before they became data points. The dashboard cannot represent students or paths the college did not record.

<!-- phil-passage-id: ch12-p0018 -->
The mirror metaphor should not be misunderstood. AI does not mirror reality itself. It mirrors a record of what institutions chose to measure, preserve, label, ignore, and reward. A system can reproduce an institution’s habits while sounding like an independent judge.

<!-- phil-passage-id: ch12-p0019 -->
Vallor’s second move changes the ethical stakes. A mirror can be treated as though it were the room itself. The student-success dashboard gives the adviser an incomplete reflection, and the college treats that reflection as objective evidence. An adviser looks at Diego’s risk score and reads it as a fact about Diego, even though the score summarizes what the model has learned to associate with sparse LMS activity. The college has treated that incomplete reflection as factual evidence about Diego.

<!-- phil-passage-id: ch12-p0020 -->
At the same time, the mirror decides something. The adviser has three hours on Monday. Those three hours are a scarce good. So is a scholarship email. So is a warning that lets a student catch a failing grade before the withdrawal deadline. So is a referral to tutoring, disability services, emergency aid, a food pantry, or a faculty mentor. When the model helps allocate those goods, the dashboard directs access to them and becomes an opportunity gate.

<!-- phil-passage-id: ch12-p0021 -->
Lisa Herzog develops this line in [“Algorithmic Bias and Access to Opportunities”](https://research.rug.nl/en/publications/algorithmic-bias-and-access-to-opportunities/) in *The Oxford Handbook of Digital Ethics*. Her argument is that algorithmic systems become especially serious when they mediate access to important goods: jobs, credit, care, education, housing, support, credibility, safety, benefits, and political voice. Bias in a movie recommender is annoying. Bias in a hiring screen, hospital triage system, benefits tool, or college advising dashboard can shape a life.

<!-- phil-passage-id: ch12-p0022 -->
Herzog’s point is not that technical fairness does not matter. It is that technical fairness does not settle the whole moral question once a system sits at an opportunity gate. The question is not only whether the model predicts accurately. The question is who gets in, who is delayed, who is sent away, who is misdescribed, who is asked to prove themselves again, and who gets locked out of the goods a life depends on.

<!-- phil-passage-id: ch12-p0023 -->
The dashboard is at that kind of gate. The scarce good is advising attention, sometimes financial aid, sometimes a referral to human support. Diego and Kai enrolled at community college because each wants a shot at a different life. What the system does with their profiles helps decide whether that shot narrows or widens.

<!-- phil-passage-id: ch12-p0024 -->
<aside class="textbox shaded" role="note" aria-labelledby="key-point-mirror-gate">
<h3 id="key-point-mirror-gate">Key Point: Mirror Versus Gate</h3>
<p>A model is a mirror when it summarizes patterns in past human data. It becomes a gate when the institution uses that summary to allocate a scarce good like attention, credit, care, housing, work, safety, or opportunity.</p>
</aside>

<!-- phil-passage-id: ch12-p0025 -->
You will use this distinction throughout the chapter. An inaccurate prediction is a technical problem. An unjust allocation is a moral problem. When students say a system is biased, they are usually talking about the second thing, whether they know it yet or not.

<!-- phil-section-id: ch12-s004 -->
## When A Proxy Replaces The Person

<!-- phil-passage-id: ch12-p0026 -->
Once a system is at an opportunity gate, the next question is what the system actually measures. Almost every AI model that helps allocate opportunity has to work with a stand-in. The thing the institution cares about is rarely something the model can see directly. Instead, the model watches something else, called a **proxy**, and treats it as a workable substitute.

<!-- phil-passage-id: ch12-p0027 -->
The dashboard is a good example. The college cares about learning, persistence, belonging, and academic progress. The model cannot see those things directly. It sees LMS logins, submission timestamps, quiz scores, registration changes, email responses, and financial-aid records. Those variables stand in for the concepts the college actually cares about. Sometimes the substitute is close enough to help. When the substitute drifts from the concept, a whole class of ethical problems opens up.

<!-- phil-passage-id: ch12-p0028 -->
Ziad Obermeyer and colleagues published the clearest example of this problem in a 2019 *Science* study, [“Dissecting racial bias in an algorithm used to manage the health of populations”](https://doi.org/10.1126/science.aax2342). The system was used in large U.S. health-care settings to identify patients for high-touch care management programs. Those programs could include additional outreach, help coordinating specialists, and closer attention between visits. Getting into the program could matter enormously for patients with chronic disease.

<!-- phil-passage-id: ch12-p0029 -->
The algorithm did what its designers asked it to do. It predicted, from prior claims and clinical records, how much health-care spending a patient was likely to generate. Patients projected to be expensive were flagged as high risk and pushed toward the care program. The design assumption was that sicker patients cost more, so predicted cost was a reasonable stand-in for medical need.

<!-- phil-passage-id: ch12-p0030 -->
Obermeyer’s team showed why that proxy was ethically dangerous. At a given risk score, Black patients were substantially sicker than white patients on clinical indicators. The model had learned to associate high medical need with high past spending. But Black patients in the data had lower past spending than their clinical need suggested because access to care had already been unequal. Their medical need did not show up as cost because the health system had not spent the money to meet it. The model, faithful to its target, folded that history forward.

<!-- phil-passage-id: ch12-p0031 -->
Notice what this case shows. The model did not simply malfunction. It was accurate about its target. Predicted spending really did track spending. The problem was that spending had been chosen as a proxy for need, and the proxy carried unequal history forward. A sick Black patient could look lower risk because the system had historically spent less on that patient’s care.

<!-- phil-passage-id: ch12-p0032 -->
The researchers showed that using health-based labels rather than cost-based labels could substantially reduce the disparity. The lesson is to examine the target morally before optimizing it technically.

<!-- phil-passage-id: ch12-p0033 -->
The same structure appears in the dashboard case. The college is not indifferent to Diego’s learning. It has chosen LMS clicks as a proxy for engagement because clicks are easy to measure. If the college’s real concern is whether Diego is learning, clicks are a poor stand-in for a student whose reading and thinking mostly happen off the platform.

<!-- phil-passage-id: ch12-p0034 -->
<aside class="textbox shaded textbox--framework-map" role="note" aria-labelledby="framework-map-proxy-distortion">
<h3 id="framework-map-proxy-distortion">Framework Map: How Common Proxies Can Distort Human Concerns</h3>
<dl>
<dt><strong>Medical need</strong></dt>
<dd><strong>Proxy:</strong> Past health-care cost. <strong>Distortion:</strong> Cost reflects unequal access, not only need. <strong>Ethical problem:</strong> The model treats unequal spending as evidence of lower need.</dd>
<dt><strong>Student engagement</strong></dt>
<dd><strong>Proxy:</strong> LMS logins and clickstream activity. <strong>Distortion:</strong> Work schedules, shared devices, disability, paper reading, and childcare can reduce platform traces. <strong>Ethical problem:</strong> The model may treat constrained access as lack of motivation.</dd>
<dt><strong>Job reliability</strong></dt>
<dd><strong>Proxy:</strong> Resume gaps or continuous employment. <strong>Distortion:</strong> Caregiving, illness, disability, military service, incarceration, immigration, or local labor markets may create gaps. <strong>Ethical problem:</strong> The model may treat unequal life paths as character defects.</dd>
<dt><strong>Communication ability</strong></dt>
<dd><strong>Proxy:</strong> Accent, grammar, or language variety. <strong>Distortion:</strong> Tools may encode majority-language expectations. <strong>Ethical problem:</strong> The model may treat dialect, accent, or multilingual writing as lower competence.</dd>
<dt><strong>Creditworthiness</strong></dt>
<dd><strong>Proxy:</strong> Payment history and zip code. <strong>Distortion:</strong> Thin files and neighborhood patterns reflect unequal banking and housing histories. <strong>Ethical problem:</strong> The model may treat exclusion from credit as evidence against future access to credit.</dd>
</dl>
</aside>

<!-- phil-passage-id: ch12-p0035 -->
The [Fairness and Machine Learning](https://fairmlbook.org/) online book by Solon Barocas, Moritz Hardt, and Arvind Narayanan makes the general form of this problem visible. Predictive models optimize the target you give them. The target is a definition of the problem, and the definition of the problem is a normative choice about what counts and what does not. When the choice is between a clean target the model can hit and a messier concept the institution actually cares about, the clean target usually wins. The institution then evaluates the clean target while the fuller human concern it meant to assess drops from view.

<!-- phil-passage-id: ch12-p0036 -->
The [Stanford Encyclopedia of Philosophy entry on algorithmic fairness](https://plato.stanford.edu/entries/algorithmic-fairness/) treats this as the proxy problem, and it treats it as one of the central issues in the philosophy of fair prediction. Once a proxy replaces the person, you can be accurate about the proxy and still be wrong about the person. That is what Obermeyer’s team documented in health care. It is also what the dashboard risks doing when it treats a click pattern as engagement, when a lender treats a zip code as creditworthiness, when a hiring model treats a resume gap as reliability, when a language tool treats accent as comprehensibility, or when a moderation system treats political or religious language as toxicity without enough context.

<!-- phil-passage-id: ch12-p0037 -->
<aside class="textbox shaded" role="note" aria-labelledby="caution-real-pattern-bad-proxy">
<h3 id="caution-real-pattern-bad-proxy">Caution: A Real Pattern Can Still Be A Bad Proxy</h3>
<p>A model can find a real statistical pattern and use it accurately, and the use can still be ethically wrong when the pattern stands in for something it does not actually measure. Predicted cost is not medical need. LMS clicks are not learning. Resume gap length is not reliability. A proxy audit asks what the model actually measures, what human concern the institution wanted, and how unequal history travels between the two.</p>
</aside>

<!-- phil-passage-id: ch12-p0038 -->
Every judgment you make about algorithmic bias should start with the proxy question. What did the model actually measure? What human concern was that measurement standing in for? How far apart did the two travel? The next step is to locate where bias entered the system.

<!-- phil-section-id: ch12-s005 -->
## Where Bias Enters

<!-- phil-passage-id: ch12-p0039 -->
Students often say “the data was biased.” Sometimes that is true. But it is too vague to guide repair. Bias can enter before data collection, during labeling, during modeling, during evaluation, at deployment, through human workflow, or through feedback loops after the system is used.

<!-- phil-passage-id: ch12-p0040 -->
Batya Friedman and Helen Nissenbaum’s classic article [“Bias in Computer Systems”](https://doi.org/10.1145/230538.230561) distinguished among preexisting, technical, and emergent bias. Preexisting bias comes from the world and institutions around the system. Technical bias comes from design decisions such as categories, formal rules, or system constraints. Emergent bias appears when a system enters a context of use that changes over time or differs from what designers expected. Harini Suresh and John Guttag’s [framework for sources of harm across the machine-learning life cycle](https://arxiv.org/abs/1901.10002) makes a similar point for modern ML: harm can enter through data generation, data collection, data preprocessing, model development, model evaluation, deployment, and feedback after deployment. NIST’s SP 1270 adds the policy lesson: managing bias requires looking at the whole sociotechnical process, not only the model file.

<!-- phil-passage-id: ch12-p0041 -->
Here is a practical map:

<!-- phil-passage-id: ch12-p0042 -->
<aside class="textbox shaded textbox--framework-map" role="note" aria-labelledby="framework-map-sites-of-bias">
<h3 id="framework-map-sites-of-bias">Framework Map: Sites of Algorithmic Bias and Likely Repairs</h3>
<dl>
<dt><strong>Historical / preexisting bias</strong></dt><dd>The data reflects unequal past conditions. <strong>Ask:</strong> What inequality is being treated as neutral evidence? <strong>Likely repair:</strong> Change the target, add context, monitor subgroup effects, or avoid using the record as a gate.</dd>
<dt><strong>Representation bias</strong></dt><dd>Some people, contexts, languages, or cases are missing or underrepresented. <strong>Ask:</strong> Who is not in the training or evaluation data? <strong>Likely repair:</strong> Collect better data, narrow deployment, or refuse high-stakes use.</dd>
<dt><strong>Measurement and label bias</strong></dt><dd>The label does not measure the thing the institution cares about. <strong>Ask:</strong> Who created the label, and what did it really measure? <strong>Likely repair:</strong> Replace the label, use multiple indicators, or add human review.</dd>
<dt><strong>Proxy / target bias</strong></dt><dd>A measurable target replaces the real human concern. <strong>Ask:</strong> Is the proxy close enough to the value it stands for? <strong>Likely repair:</strong> Redefine the target, change thresholds, or redesign the decision.</dd>
<dt><strong>Category bias</strong></dt><dd>People are sorted into administrative boxes that fit some groups poorly. <strong>Ask:</strong> Who does the category misname, erase, or overexpose? <strong>Likely repair:</strong> Revise categories, allow self-description, or reduce unnecessary classification.</dd>
<dt><strong>Model objective bias</strong></dt><dd>The system optimizes one formal goal and ignores others. <strong>Ask:</strong> What does the model reward, and what does it make invisible? <strong>Likely repair:</strong> Change objective functions, add constraints, or include qualitative review.</dd>
<dt><strong>Evaluation bias</strong></dt><dd>The system is tested on cases that do not represent real-world burdens. <strong>Ask:</strong> Does high average accuracy hide subgroup failure? <strong>Likely repair:</strong> Test across affected groups and contexts; evaluate errors by consequence.</dd>
<dt><strong>Deployment / context bias</strong></dt><dd>A model built for one setting is used in another. <strong>Ask:</strong> Does the local context change what the score means? <strong>Likely repair:</strong> Local validation, limited rollout, staff training, or nondeployment.</dd>
<dt><strong>Human workflow bias</strong></dt><dd>People use the output under time pressure, incentives, or institutional habits. <strong>Ask:</strong> How will staff actually act on the score? <strong>Likely repair:</strong> Redesign workflow, slow decisions, or require reasons for override and nonoverride.</dd>
<dt><strong>Feedback-loop bias</strong></dt><dd>Outputs shape later data and future decisions. <strong>Ask:</strong> Does the system create the evidence it later uses to justify itself? <strong>Likely repair:</strong> Monitor downstream effects, break self-confirming loops, and periodically reset assumptions.</dd>
</dl>
</aside>

<!-- phil-passage-id: ch12-p0043 -->
Three labels distinguish where bias enters a system.

<!-- phil-passage-id: ch12-p0044 -->
**Latent or system bias** is built into the data, labels, categories, target, or model before a particular decision is made. Obermeyer’s cost proxy is a system-level problem. The issue was not one doctor’s prejudice. The target carried unequal history.

<!-- phil-passage-id: ch12-p0045 -->
**Deployment or context bias** appears when a system enters a local institution. A dashboard trained on residential full-time students may behave differently when used for working adults, online students, multilingual students, veterans, parents, rural students, or students with inconsistent broadband access. The model may not be “bad” in the abstract. It may be bad for this gate, in this institution, with this population.

<!-- phil-passage-id: ch12-p0046 -->
**Interaction risk** appears when humans respond to the system. Staff may overtrust scores, ignore students who are not flagged, treat risk labels as character judgments, or use the dashboard to justify resource cuts. A model can change human attention even when the model’s output is advisory.

<!-- phil-passage-id: ch12-p0047 -->
Different locations of bias require different repairs. A representation problem may need better data. A proxy problem may need a different target. A deployment mismatch may need local validation. A contestability problem may need appeal rights. A structural opportunity problem may require changing the institution, not the model.

<!-- phil-passage-id: ch12-p0048 -->
<aside class="textbox shaded" role="note" aria-labelledby="key-point-locate-bias">
<h3 id="key-point-locate-bias">Key Point: Locate The Bias Before You Prescribe The Fix</h3>
<p>“The system is biased” is not yet an ethical diagnosis. Ask where the bias enters: history, data, labels, proxies, categories, objectives, evaluation, deployment, human workflow, or feedback. The location of the wrong shapes the repair.</p>
</aside>

<!-- phil-section-id: ch12-s006 -->
## Wronging The Person

<!-- phil-passage-id: ch12-p0049 -->
Assume the proxy question has been asked. Assume the model has been trained on real patterns and deployed with care. Somebody still gets hurt. The question a philosopher of discrimination asks is what makes that harm a wrong done to the individual person.

<!-- phil-passage-id: ch12-p0050 -->
Deborah Hellman’s account in [*When Is Discrimination Wrong?*](https://digitalcommons.law.umaryland.edu/books/21/) starts with a moral intuition many students share. Not every unequal treatment is discriminatory. Age-based licensing is unequal. Height requirements for pilots are unequal. Grading rubrics are unequal. What makes some classifications feel like a wrong against the person is that they demean: they express, enact, or reinforce lower social standing from a position of social power. Demeaning treatment is not merely treatment that hurts someone’s feelings. It is treatment that treats someone as lesser in status or worth.

<!-- phil-passage-id: ch12-p0051 -->
Sophia Moreau develops a pluralist view in [*Faces of Inequality*](https://academic.oup.com/book/36783/chapter/321925342). She argues that discrimination can wrong people in several ways: by subordinating them, by restricting their deliberative freedom, or by denying them access to basic goods on grounds unrelated to those goods. Moreau’s account helps explain why a person can be wronged by an algorithm even when no one explicitly insults them. Diego cannot argue with the LMS about how he studies. The dashboard has already decided what his behavior means.

<!-- phil-passage-id: ch12-p0052 -->
Benjamin Eidelson’s [*Discrimination and Disrespect*](https://hls.harvard.edu/bibliography/discrimination-and-disrespect/) sharpens the intuition into a claim about personhood. Discrimination is intrinsically wrong when it manifests disrespect for the person as a rational, individual agent. To treat someone through a group profile they did not choose, without attention to the particular person in front of you, is to fail to acknowledge them as a person.

<!-- phil-passage-id: ch12-p0053 -->
Read together, Hellman, Moreau, and Eidelson give students a family of individual-wrong accounts. They all locate the wrong in what the system does to the person: the meaning of the classification, the restriction of agency, the failure to treat the person as someone who can answer for themselves. The [SEP entry on discrimination](https://plato.stanford.edu/entries/discrimination/) surveys these accounts alongside harm-based views, which locate the wrong in concrete damage done. Both families matter for algorithmic cases. The individual-respect view is useful when the classification itself is the wrong. The harm-based view is useful when the classification produces concrete losses.

<!-- phil-passage-id: ch12-p0054 -->
Take Obermeyer again. On the individual-wrong reading, the wrong done to a Black patient scored as lower risk is that the health system treated her through a proxy that reduced her clinical reality to a spending record. The system saw a lower-cost claim history and missed the person with uncontrolled diabetes, hypertension, or heart disease. No human doctor had to sneer at her for the disrespect to be present. An institutional process had already replaced her with a number that carried the meaning of a history she did not choose.

<!-- phil-passage-id: ch12-p0055 -->
The individual-wrong view has limits. It works well when you can locate a particular person whose respect, agency, or standing was diminished. It works less well when the harm is spread thin across many people, none of whom can point to one moment when they were personally insulted. Herzog and other structural theorists argue that some algorithmic systems produce harms of this second kind, and that reducing every case to an individual wrong loses something real about how modern systems shape whole populations. The next section takes that reply seriously.

<!-- phil-passage-id: ch12-p0056 -->
For the philosophy of discrimination, though, the individual-wrong tradition gives students their first useful vocabulary. When you ask what kind of wrong is at stake in an algorithmic case, the first question is whether a particular person is being treated through a classification that fails to treat them as an equal. If yes, the language of Hellman, Moreau, and Eidelson can help you name what has gone wrong even when the model is accurate on average.

<!-- phil-section-id: ch12-s007 -->
## Wronging The Opportunity Structure

<!-- phil-passage-id: ch12-p0057 -->
The dashboard case can be described a second way that does not run primarily through one person being demeaned.

<!-- phil-passage-id: ch12-p0058 -->
Iris Marion Young’s [social connection model](https://academic.oup.com/book/4381/chapter/146336683), from *Responsibility for Justice*, argues that many serious harms in modern life are not produced by one identifiable wrongdoer. They are produced by the ordinary functioning of institutions whose rules, defaults, incentives, categories, and feedback loops leave some groups reliably worse off. Young calls this structural injustice. Nobody at the college is malicious. The adviser wants to help. The vendor sold a product intended to save at-risk students. The IT staff followed procurement rules. The problem can still be structural if the system repeatedly routes some students into thin, stigmatizing, or ineffective forms of attention while missing other students whose need does not match the data trail.

<!-- phil-passage-id: ch12-p0059 -->
This structural account clarifies the Diego/Kai case. Diego is not simply receiving less attention. He may receive the wrong kind of attention: a risk label built from thin proxies rather than a serious understanding of work, childcare, commuting, disability, shared-device access, language, family obligation, or financial pressure. Kai shows the opposite danger: a student can look fine to the dashboard while needing help the system does not know how to see. A biased system can over-detect some students under the wrong description and under-detect others because their need is invisible to the measured features.

<!-- phil-passage-id: ch12-p0060 -->
Herzog applies Young’s structural injustice frame directly to algorithmic bias. When a college, hospital, bank, landlord, employer, or public agency uses a model to decide who gets in, the model becomes part of the institutional machinery that shapes opportunity. If the model reflects a history of unequal access, the resulting decisions can reproduce and intensify that history. Herzog uses Robert Merton’s language of **Matthew effects** to describe the pattern. Small advantages compound. A student flagged as promising gets attention, which produces engagement data, which confirms the flag. A student flagged as risky gets generic warning messages, which feel like being watched, which reduce engagement, which confirms the flag. The later data can appear to confirm the original flag because the flag helped shape the conditions it records.

<!-- phil-passage-id: ch12-p0061 -->
Feedback loops are central here. A biased system can create a record that later systems treat as evidence. If Diego is repeatedly marked as risky, receives generic interventions, misses human advising, or is routed into narrower options, later records may confirm the system’s original picture. If Kai is repeatedly missed, her need may only appear after the situation becomes a crisis. Bias becomes self-reinforcing when the output of one decision becomes the input for the next.

<!-- phil-passage-id: ch12-p0062 -->
Kathleen Creel and Deborah Hellman push the point further in [“The Algorithmic Leviathan”](https://www.cambridge.org/core/journals/canadian-journal-of-philosophy/article/algorithmic-leviathan-arbitrariness-fairness-and-opportunity-in-algorithmic-decisionmaking-systems/3AA0ECA77F8622488E9DB0834287215B). Their argument is that a single algorithmic decision may not obviously wrong someone. What changes is scale and repetition. When college applications, loan applications, job screens, insurance rates, rental applications, and benefits checks all use similar systems with similar proxies and similar assumptions, a person who scores badly on one is likely to score badly on many. Repeated scoring across these systems can turn a local flag into a durable barrier across institutions.

<!-- phil-passage-id: ch12-p0063 -->
The FAccT paper [“Algorithmic Pluralism”](https://arxiv.org/abs/2305.08157), by Shomik Jain, Vinith Suriyakumar, Kathleen Creel, and Ashia Wilson, offers a related move by extending Joseph Fishkin’s theory of opportunity bottlenecks into algorithmic decision-making. Fishkin argues that fair opportunity depends on there being many routes through life’s bottlenecks. If one narrow gate controls whether you can become a nurse, homeowner, engineer, teacher, or small-business owner, then anyone screened out at that gate loses more than one opportunity. Algorithmic systems can narrow gates when many institutions rely on similar screening logic. A single gate can be dangerous even when it is accurate, because it has no redundancy. If it misjudges a person, the person has nowhere else to go.

<!-- phil-passage-id: ch12-p0064 -->
Bring this back to the dashboard. The individual-wrong view asks whether Diego was treated as an equal. The structural view asks what happens to the group of students whose lives do not line up with an LMS. It asks whether the college’s system, combined with lenders, landlords, employers, benefits offices, and other institutions, produces a life in which a particular kind of person is repeatedly misread or quietly locked out of goods others can access. On this view, the wrong is not only a moment of disrespect. It is a slow narrowing of opportunity that no one person chose and that many people have to live inside.

<!-- phil-passage-id: ch12-p0065 -->
The [SEP entry on equality of opportunity](https://plato.stanford.edu/entries/equal-opportunity/) treats this as a live question in political philosophy. The [SEP entry on distributive justice](https://plato.stanford.edu/entries/justice-distributive/) surveys the broader family of views about how institutions should distribute benefits and burdens. Both surveys make the same background point: fair opportunity is not the same as accurate prediction. A society can have models that predict outcomes well and still be unjust if the outcomes it predicts are being produced by an unjust process.

<!-- phil-passage-id: ch12-p0066 -->
The structural view has its own limits. It can miss the individual whose complaint begins with how they were treated, even when no broad population pattern is visible. It can also tempt people to say no one is responsible for any particular decision, which is false. But it captures something the individual-wrong tradition cannot. Some of what algorithmic bias does happens across time, across institutions, across many small decisions, and its wrong is best seen at that scale.

<!-- phil-passage-id: ch12-p0067 -->
<aside class="textbox shaded" role="note" aria-labelledby="framework-map-four-wrongs">
<h3 id="framework-map-four-wrongs">Framework Map: Four Ways To Locate The Wrong</h3>
<p>When you audit an algorithmic bias case, ask which wrong is central. More than one can apply.</p>
<ul>
<li><strong>Individual respect / wrongful discrimination.</strong> The system fails to treat the person as an equal by demeaning them, restricting agency, or reducing them to a group profile.</li>
<li><strong>Structural opportunity / compounding injustice.</strong> The system, alone or together with other systems, narrows access to important goods and reinforces unequal life paths.</li>
<li><strong>Welfare and error distribution.</strong> The wrong lies in who bears false positives, false negatives, delays, denials, extra scrutiny, or exclusion.</li>
<li><strong>Procedural legitimacy / contestability.</strong> The system is wrong when affected people cannot understand, challenge, correct, or escape decisions that shape their futures.</li>
</ul>
</aside>

<!-- phil-passage-id: ch12-p0068 -->
The four can overlap. In the dashboard case, Diego may have a personal complaint about being read through a template. He may also be one of many students whose opportunity is being narrowed across institutions. The college may have a welfare tradeoff hidden inside its metric. And he may have no way to see or contest the score. When students ask which wrong is at stake, the honest answer will often be “several.” Your job as an ethical thinker is to name the wrong that drives the case, so that you can say what the institution actually has to change.

<!-- phil-section-id: ch12-s008 -->
## Which Fairness Counts?

<!-- phil-passage-id: ch12-p0069 -->
Once you have decided that a system is at an opportunity gate and that its proxy carries moral weight, you might reasonably ask whether a technical fix could handle the rest. The fairness literature in machine learning has spent years trying to define what a fair model should satisfy.

<!-- phil-passage-id: ch12-p0070 -->
The [Stanford Encyclopedia entry on algorithmic fairness](https://plato.stanford.edu/entries/algorithmic-fairness/) and [Fairness and Machine Learning](https://fairmlbook.org/) walk through the main options. The details can become mathematical, but students need the basic conclusion first. Fairness is not one thing.

<!-- phil-passage-id: ch12-p0071 -->
<aside class="textbox shaded textbox--framework-map" role="note" aria-labelledby="framework-map-fairness-ideas">
<h3 id="framework-map-fairness-ideas">Framework Map: What Different Fairness Ideas Protect and Miss</h3>
<dl>
<dt><strong>Demographic or statistical parity</strong></dt><dd><strong>Ask:</strong> Do groups receive the outcome at similar rates? <strong>Protects:</strong> Against gross exclusion from opportunities. <strong>Can miss:</strong> Differences in context, need, qualification, or error costs.</dd>
<dt><strong>Predictive parity / calibration</strong></dt><dd><strong>Ask:</strong> Does the same score mean the same thing across groups? <strong>Protects:</strong> Score interpretation. <strong>Can miss:</strong> Unequal false-positive or false-negative burdens.</dd>
<dt><strong>Equal opportunity</strong></dt><dd><strong>Ask:</strong> Are qualified people from different groups selected at similar rates? <strong>Protects:</strong> Access for those who should receive the good. <strong>Can miss:</strong> Whether the definition of “qualified” is itself fair.</dd>
<dt><strong>Equalized odds</strong></dt><dd><strong>Ask:</strong> Are false-positive and false-negative rates similar across groups? <strong>Protects:</strong> Against unequal burdens of mistakes. <strong>Can miss:</strong> Whether the outcome itself is just.</dd>
<dt><strong>Individual fairness</strong></dt><dd><strong>Ask:</strong> Are similar people treated similarly? <strong>Protects:</strong> Against arbitrary inconsistency between persons. <strong>Can miss:</strong> Who decides what “similar” means.</dd>
<dt><strong>Substantive opportunity</strong></dt><dd><strong>Ask:</strong> Does the system improve real access to the underlying good? <strong>Protects:</strong> Structural equality and actual life chances. <strong>Can miss:</strong> This is harder to measure and requires institutional judgment.</dd>
</dl>
</aside>

<!-- phil-passage-id: ch12-p0072 -->
Choosing a fairness metric is not only a math choice. It is a moral choice about which kind of wrong matters most in the context.

<!-- phil-passage-id: ch12-p0073 -->
Suppose a lender wants applicants from two regions to have the same repayment likelihood at the same score, wants borrowers who would repay to be approved at the same rate in both regions, and wants the same overall approval rate in both places. The mathematics will not always cooperate. In many real settings, especially when base rates differ and predictions are imperfect, several appealing fairness criteria cannot all be satisfied at once. This does not mean fairness is impossible. It means fairness criteria answer different moral questions, and institutions have to decide which tradeoff they can defend.

<!-- phil-passage-id: ch12-p0074 -->
Selbst and colleagues make a related but distinct point in [“Fairness and Abstraction in Sociotechnical Systems”](https://doi.org/10.1145/3287560.3287598). Even when a fairness metric is picked and a model is tuned to satisfy it, the metric is defined at the level of the model. The world the model enters is not the world the metric described. A hiring model that is calibrated on training data can still produce unfair results once it is deployed inside an actual workplace, with actual managers, applicant behavior, incentives, and downstream consequences. Their warning is that treating fairness as a property of the model alone hides the parts of the problem that live outside the model’s boundary.

<!-- phil-passage-id: ch12-p0075 -->
The same structure appears when the scarce good is speech, visibility, or credibility. In ACL 2024, Bang, Chen, Lee, and Fung’s [“Measuring Political Bias in Large Language Models”](https://aclanthology.org/2024.acl-long.600/) argues that political bias can appear in both what a model says and how it says it. A 2024 FAccT paper on [algorithmic arbitrariness in content moderation](https://arxiv.org/html/2402.16979v1) shows a related risk in moderation systems: different classifiers can perform similarly on average while assigning conflicting toxicity labels to the same content. A 2026 *npj Artificial Intelligence* study by Maarten Buyl and colleagues, [“Large language models reflect the ideology of their creators”](https://www.nature.com/articles/s44387-025-00048-0), finds that LLM outputs can reflect differences across regions, languages, and design choices. These examples broaden the chapter’s frame. Automated systems can classify beliefs, speech, religion, politics, or worldview through rules the affected people may not see.

<!-- phil-passage-id: ch12-p0076 -->
Political bias in chatbots is one illustration. Algorithmic bias can involve worldview as well as demographic categories. A system can distribute credibility, visibility, or suspicion in ways that matter even when no one is denied a loan or a job.

<!-- phil-passage-id: ch12-p0077 -->
Return to the dashboard. Suppose the college wants its risk scores to satisfy predictive parity. Students at the same score complete at the same rate across every group. That sounds reassuring. It is still compatible with the model concentrating false-negative errors on working-adult students, so that the students most likely to be missed by the system are the ones already fighting the hardest to stay in school. Predictive parity is a real fairness property, and it is not always the property that helps the person the model gets wrong.

<!-- phil-passage-id: ch12-p0078 -->
Which fairness counts is a question the institution has to answer, and the model cannot answer it for them. Some errors carry more weight than others. Missing a heart patient carries more weight than flagging a healthy patient. Missing a struggling student may carry more weight than sending a strong one an extra email. The fairness metric can make those tradeoffs visible. Deciding which tradeoff is defensible is moral work, and it belongs to the people responsible for the system, guided by the affected community.

<!-- phil-passage-id: ch12-p0079 -->
Herzog’s stronger claim is that no purely technical adjustment settles the underlying problem. If a system is at an opportunity gate, and its errors are being borne by people who already had less access, tuning a fairness parameter does not touch the reason those people had less access in the first place. Better fairness metrics can help. They cannot substitute for the institutional work of asking what the system is for and who is being burdened by it.

<!-- phil-section-id: ch12-s009 -->
## Better Than Human Is Not Enough

<!-- phil-passage-id: ch12-p0080 -->
The strongest objection to the argument so far is not that algorithmic bias is fake. The strongest objection is that human decision makers are biased too. They are tired, hurried, distracted, inconsistent, and influenced by institutional incentives. Hiring, admissions, health care, lending, discipline, policing, and benefits systems already contain unequal histories. If an algorithm is less biased than the humans it replaces, is it not ethically better to use the algorithm, even when it remains imperfect?

<!-- phil-passage-id: ch12-p0081 -->
Take the objection seriously. In some cases the answer is yes. A well-designed screen used as one input, alongside meaningful human review, can reduce concentrated biases that a single tired reviewer might carry through a whole file. The Obermeyer case itself does not show that algorithmic triage should always be abandoned. It shows that the proxy must be examined and changed. A health-needs target can be better than a cost target. A model with better labels, evaluation, monitoring, and contestability may improve care compared with the human status quo.

<!-- phil-passage-id: ch12-p0082 -->
Some settings make refusal morally costly. A rural clinic that cannot afford full-time specialists may catch more strokes with an imperfect triage model than without one. A benefits office with a backlog may leave more people without support if it refuses every automated aid. A college with too few advisers may reach more students if a dashboard helps identify patterns human staff would otherwise miss. Refusal in the name of ethical purity is a real move that carries a real bill, and the bill is often paid by the people the system was supposed to help.

<!-- phil-passage-id: ch12-p0083 -->
The objection has limits. Better on average is not the same as better across the board. A model that reduces the average error rate can concentrate its remaining errors on a smaller group whose lives depend on being seen. Comparative performance is one variable in a moral judgment. It cannot settle the proxy question, the opportunity question, or the contestability question by itself.

<!-- phil-passage-id: ch12-p0084 -->
Ask what the model actually predicts. If the target is a proxy and the proxy carries unequal history, better average performance may hide the same wrong in a smoother form. Ask who bears the errors. If false negatives fall on the group already least served, the model may be more accurate overall while doing more damage where it counts. Ask what the model gates. If the good it allocates is decisive for a life, small percentage improvements can still leave particular people locked out. Ask what the affected person can do. If a decision can be made about you by a system you cannot see and cannot challenge, then even a well-performing system may be procedurally unjust.

<!-- phil-passage-id: ch12-p0085 -->
The honest form of the objection is that deployment can sometimes be justified when a model outperforms the human status quo on the metrics that matter, when its proxies have been examined and revised, when its errors do not fall unevenly on vulnerable groups, when its use improves rather than narrows access, and when decisions remain answerable to the people they touch. That is a demanding standard. It does not translate into a rule that any better-than-human system should be used. It is closer to a checklist for institutions considering deployment.

<!-- phil-passage-id: ch12-p0086 -->
<aside class="textbox shaded" role="note" aria-labelledby="caution-better-than-human">
<h3 id="caution-better-than-human">Caution: Better Than Human Is A Starting Point, Not A Verdict</h3>
<p>A model may outperform human decision makers and still be unjustified. Comparative accuracy matters, but it does not settle proxy choice, error burden, opportunity structure, or contestability.</p>
</aside>

<!-- phil-section-id: ch12-s010 -->
## Who Can Answer The Decision?

<!-- phil-passage-id: ch12-p0087 -->
The last stake in the chapter is procedural. Even a system that measures well, respects the person, distributes errors fairly, and preserves opportunity can still be ethically defective when the people affected by it have no way to answer back.

<!-- phil-passage-id: ch12-p0088 -->
Danielle Citron and Frank Pasquale’s work on algorithmic due process, developed in [“The Scored Society”](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2376209), argues that consequential automated decisions have to be answerable in a specific sense. The person affected needs to know an algorithm was involved, understand the general basis of the decision, have a way to challenge specific errors, and have a route to a real decision maker when the system is wrong. Transparency in the abstract is not enough. Affected people need to be able to act on what they learn.

<!-- phil-passage-id: ch12-p0089 -->
Kars Alfrink and colleagues develop this into a design agenda in [“Contestable AI by Design”](https://link.springer.com/article/10.1007/s11023-022-09611-z). Their argument is that contestability has to be built into a system from the beginning, and that it has to include the whole lifecycle: how the model is developed, how it is trained, how it is deployed, how it can be challenged in individual cases, and how it can be repaired or withdrawn when it is doing more harm than good. A late-added appeal form is not enough. Contestability means the system has been designed on the assumption that people will need to respond to it.

<!-- phil-passage-id: ch12-p0090 -->
Creel and Hellman’s structural argument explains the same problem at ecosystem scale. If your loan denial, rental screen, and job application are all run through similar automated systems, and each one has a technically valid appeal process nobody actually uses, the aggregate effect is that you cannot answer any of them. The right to contest can be present on paper and absent in practice. Contestability has to be evaluated across the full ecosystem of decisions a person faces.

<!-- phil-passage-id: ch12-p0091 -->
<table class="shaded">
<caption>Weak and stronger forms of contestability</caption>
<thead>
<tr><th scope="col">Weak contestability</th><th scope="col">Stronger contestability</th></tr>
</thead>
<tbody>
<tr><th scope="row">“You may appeal.”</th><td>The person knows a decision was made, what role the system played, and how to challenge it.</td></tr>
<tr><th scope="row">A generic complaint form.</th><td>A review process with authority to change the outcome.</td></tr>
<tr><th scope="row">A vague explanation.</th><td>A reason connected to the actual evidence and decision logic.</td></tr>
<tr><th scope="row">A human rubber stamp.</th><td>A human reviewer with time, knowledge, independence, and authority.</td></tr>
<tr><th scope="row">Internal review only.</th><td>External audit or oversight where stakes are high.</td></tr>
<tr><th scope="row">Correction of one data error only.</th><td>Repair of the proxy, workflow, threshold, or policy when the pattern is systemic.</td></tr>
</tbody>
</table>

<!-- phil-passage-id: ch12-p0092 -->
Contestability also asks about the human loop. A system with a nominal human reviewer who has three seconds per case and no authority to reverse the model is not a contested system. It is an automated system dressed up as a supervised one. A real human loop requires time, training, standing to override, and consequences when the override is ignored. Without those elements, the loop cannot provide oversight; it merely validates the model's decision.

<!-- phil-passage-id: ch12-p0093 -->
Return once more to Diego. Suppose the dashboard is well tuned. Suppose the college has thought about individual respect, structural opportunity, and error distribution. Suppose the model has been calibrated and the proxy has been revised. Diego still might have no idea he was scored. He might have no idea what pushed him to the top of the outreach queue. If an adviser lets slip that the system had him flagged as high risk, he might have no way to see the flag, correct the record, or ask what would make it change. On the four-wrongs map, that is the procedural wrong. Even if the outreach helps him, the invisibility of the scoring erodes his standing as someone who can answer for himself in the institution making decisions about him.

<!-- phil-passage-id: ch12-p0094 -->
NIST’s report points institutions toward this kind of accountability. It treats bias as a sociotechnical property of the whole model-and-institution system, and it identifies governance, monitoring, appeal, oversight, and correction processes as part of responsible bias management. The philosophical claim underneath is the one Citron, Pasquale, and Alfrink defend: people subject to consequential algorithmic decisions need real ways to answer them.

<!-- phil-section-id: ch12-s011 -->
## Technical Repair, Moral Repair, And Refusal

<!-- phil-passage-id: ch12-p0095 -->
A student who sees a biased system often asks, “How do we fix the model?” A technical repair may correct a model while leaving the institution's proxy, workflow, or opportunity gate unchanged.

<!-- phil-passage-id: ch12-p0096 -->
<aside class="textbox shaded textbox--framework-map" role="note" aria-labelledby="framework-map-repair-options">
<h3 id="framework-map-repair-options">Framework Map: Repair Options and Their Ethical Limits</h3>
<dl>
<dt><strong>Data repair</strong></dt><dd>Improves or supplements training data. <strong>Example:</strong> Add missing groups, correct records, or collect data in underserved contexts. <strong>Limit:</strong> May still preserve unjust institutional categories.</dd>
<dt><strong>Label repair</strong></dt><dd>Changes what the model is trained to predict. <strong>Example:</strong> Replace health-care cost with clinical need. <strong>Limit:</strong> May still miss values that are difficult to label.</dd>
<dt><strong>Model repair</strong></dt><dd>Changes features, thresholds, objectives, or fairness constraints. <strong>Example:</strong> Reduce unequal false-negative rates across groups. <strong>Limit:</strong> May still optimize the wrong institutional goal.</dd>
<dt><strong>Evaluation repair</strong></dt><dd>Changes how performance is tested. <strong>Example:</strong> Report subgroup errors and high-stakes failure modes, not only average accuracy. <strong>Limit:</strong> May not change deployment incentives.</dd>
<dt><strong>Interface repair</strong></dt><dd>Changes how humans see and use outputs. <strong>Example:</strong> Add uncertainty, explanations, warnings, and override routes. <strong>Limit:</strong> May not change power or workflow.</dd>
<dt><strong>Process repair</strong></dt><dd>Changes the institutional workflow. <strong>Example:</strong> Require human review before denying aid, credit, or care. <strong>Limit:</strong> May become rubber-stamp review.</dd>
<dt><strong>Contestability repair</strong></dt><dd>Gives affected people real routes to challenge decisions. <strong>Example:</strong> Appeal, correction, documentation, or external review. <strong>Limit:</strong> Requires authority, not merely a complaint form.</dd>
<dt><strong>Structural repair</strong></dt><dd>Changes the opportunity system itself. <strong>Example:</strong> More advisers, fewer bottlenecks, alternative pathways, or better access. <strong>Limit:</strong> Harder and more expensive than model repair.</dd>
<dt><strong>Refusal</strong></dt><dd>Decides not to automate a decision. <strong>Example:</strong> Do not use risk scoring for a high-stakes judgment that cannot be made contestable. <strong>Limit:</strong> Requires willingness to give up efficiency, control, or cost savings.</dd>
</dl>
</aside>

<!-- phil-passage-id: ch12-p0097 -->
This table helps avoid a common mistake. A model can be technically repaired while the institution remains morally unrepaired. Imagine a hiring platform that lowers subgroup error differences but still treats continuous employment as a sign of merit in a labor market where caregiving, disability, immigration, and economic instability have shaped people’s work histories. The model may improve, but the gate may remain unjust.

<!-- phil-passage-id: ch12-p0098 -->
The reverse can also happen. An institution may make a moral repair that does not look like a model update. A college might decide that the dashboard can suggest outreach but cannot label students in advising notes. It might require advisers to ask students about work, childcare, device access, disability, and transportation before treating a risk score as evidence. It might give students a way to see and correct records. It might hire more advisers instead of using the model to ration attention more efficiently. Those are repairs to the institution, not only to the code.

<!-- phil-passage-id: ch12-p0099 -->
Building like a philosopher means matching the repair to the wrong: revise a bad proxy; inspect errors and change thresholds for unequal error burdens; change classifications and hearing processes for disrespect; create alternative routes and reduce bottlenecks for structural opportunity; make procedural systems contestable; and refuse a system that cannot be repaired without making people subject to an illegitimate gate.

<!-- phil-section-id: ch12-s012 -->
## A Bias Judgment Audit

<!-- phil-passage-id: ch12-p0100 -->
Use the **Bias Judgment Audit** when you examine an algorithmic system in a documented case. Walk through these questions in order and write short answers. The answers identify the question requiring judgment and the evidence needed to answer it.

<!-- phil-passage-id: ch12-p0101 -->
1. **The gate.** What scarce good does this system allocate? Attention, jobs, credit, care, housing, benefits, information, credibility, safety, mobility, education, visibility, or discipline?
2. **The mirror.** What patterns in past human or institutional behavior is the model trained on? What is missing from that mirror? Who is not standing in front of it?
3. **The proxy.** What is the model’s actual target, and what human concern is it standing in for? How far is the gap between the two? Where in that gap does unequal history live?
4. **The location of bias.** Is the problem historical, representational, measurement-based, proxy-based, categorical, objective-based, evaluative, deployment-based, workflow-based, feedback-based, or mixed?
5. **The individual wrong.** Is a person being treated through a classification that fails to treat them as an equal? Whose respect, agency, belief, worldview, political standing, religious standing, or personhood is being diminished?
6. **The structural wrong.** Across many uses, and combined with other systems, does this model narrow access to important goods for some group over time? Are feedback loops or Matthew effects at work?
7. **The error burden.** Who bears false positives and false negatives? Are errors concentrated on people already worst served by the institution?
8. **The fairness choice.** Which fairness idea matters most here: parity, calibration, equal opportunity, equalized odds, individual fairness, or substantive access? What tradeoff does that choice create?
9. **The deployment case.** Is this system better than the human alternative on the metrics that matter? Better on average, or better across affected groups? Does that improvement settle the proxy, opportunity, and contestability questions?
10. **The contestability check.** Can affected people know a decision was automated, see the reasons, challenge the record, and reach a human with authority to reverse the system when it is wrong? Is that route real, or paper?
11. **The repair judgment.** Given your answers, what would the institution have to change? Is the right response data repair, label repair, model repair, evaluation repair, interface repair, process repair, contestability repair, structural repair, or refusal?

<!-- phil-passage-id: ch12-p0102 -->
<aside class="textbox examples" aria-labelledby="completed-example-student-dashboard">
<h3 id="completed-example-student-dashboard">Completed Example: Student-Success Dashboard</h3>

**Gate.** Advising attention, intervention priority, emergency support, and possibly the tone of future advising interactions.

**Mirror.** The system reflects LMS activity, registration records, grades, financial-aid status, attendance, and past completion patterns. It may miss offline study, paper reading, work schedules, childcare, disability, transportation, mental health, multilingual learning, shared-device access, and students who stopped out before the institution understood why.

**Proxy.** LMS activity stands in for engagement. Registration stability stands in for commitment. Past completion patterns stand in for future likelihood of success. Each proxy may be useful, but none is identical to the human concern.

**Location of bias.** Mixed. Historical data may reflect who the college served well in the past. Measurement bias appears because some forms of effort are not logged. Deployment bias appears if a model built from one student population is used with another. Workflow bias appears if advisers treat the risk score as a full description rather than a prompt for conversation. Feedback-loop bias appears if risk labels shape future records.

**Individual wrong.** Diego may be treated under a false description, such as “disengaged,” rather than as someone navigating work, childcare, and device constraints. Kai may be treated as fine because the measured features miss distress.

**Structural wrong.** Students whose lives do not create the “right” digital traces may be repeatedly routed into risk categories or generic nudges, while students with less visible needs may be missed until crisis. The opportunity structure narrows if dashboard categories become the normal path into support.

**Error burden.** Diego bears a false-positive or distorted-positive burden: scrutiny under the wrong interpretation. Kai bears a false-negative burden: missing support because distress does not register.

**Fairness choice.** Equalized odds may matter because false positives and false negatives carry different burdens across groups. Substantive opportunity also matters because the goal is not just equal scoring; it is real access to support.

**Deployment case.** The dashboard may still be justified if it helps advisers find students they would otherwise miss, but only if the college tests subgroup errors, avoids treating risk scores as character descriptions, and preserves human judgment.

**Contestability.** Students should know when algorithmic scoring affects advising, have ways to correct records, reach human advisers, and challenge interpretations.

**Repair judgment.** Better data alone is not enough. The institution may need revised proxies, subgroup error audits, adviser training, student-facing explanations, appeal routes, and more human advising capacity.

</aside>

<!-- phil-passage-id: ch12-p0103 -->
<aside class="textbox examples" aria-labelledby="completed-mini-audit-hiring-screen">
<h3 id="completed-mini-audit-hiring-screen">Completed Mini-Audit: AI Hiring Screen</h3>

**Case.** A company uses an AI resume screen to rank applicants for entry-level analyst positions.

**Gate.** Interview access.

**Proxy.** Prior internships, continuous employment, school prestige, keyword overlap, and writing style stand in for ability to do the job.

**Likely wrong.** The central wrong may be structural opportunity. Applicants from colleges with fewer internship pipelines, people with caregiving gaps, disabled applicants, rural applicants, veterans, and workers changing careers may be filtered out before any human sees them.

**Fairness question.** Average accuracy is not enough. The company should ask who receives false negatives and whether the tool creates a narrow bottleneck into the profession.

**Contestability and repair.** Applicants should know AI screening is used, receive meaningful explanation when rejected, and have an alternative route if the screen is likely to misread their background. The company should test subgroup errors, revise proxies, use human review for borderline cases, and refuse fully automated rejection if the system cannot be made answerable.

</aside>

<!-- phil-passage-id: ch12-p0104 -->
<aside class="textbox exercises" aria-labelledby="try-it-bias-judgment-audit">
<h3 id="try-it-bias-judgment-audit">Try It: Bias Judgment Audit</h3>
<p>Pick one algorithmic system in your field. Answer the audit questions in one or two sentences each. Then finish this sentence in one paragraph: “The central ethical wrong in this system is best described as ______, because ______, and the institution should ______.” Explain why the wrong you name is central.</p>
</aside>

<!-- phil-passage-id: ch12-p0105 -->
You do not need to have every answer. You do need to be able to say which wrong is central and why. That is the judgment this chapter has been building toward. Naming the wrong precisely is how you know what you are asking for when you ask an institution to change.

<!-- phil-passage-id: ch12-p0106 -->
<aside class="textbox shaded" role="note" aria-labelledby="common-mistakes-bias-arguments">
<h3 id="common-mistakes-bias-arguments">Common Mistakes In Algorithmic Bias Arguments</h3>
<ul>
<li>“Biased” does not always mean inaccurate.</li>
<li>Higher average accuracy does not prove just deployment.</li>
<li>A fairness metric is not the same as moral repair.</li>
<li>Transparency is not the same as contestability.</li>
<li>A human reviewer is not meaningful if they lack time, authority, independence, or information.</li>
<li>Better data cannot fix an unjust gate by itself.</li>
<li>A system can be biased even when it does not use a protected category directly.</li>
<li>A system can help some members of a group while still worsening the opportunity structure for others.</li>
</ul>
</aside>

<!-- phil-passage-id: ch12-p0107 -->
Institutions have several repair paths. They can improve models, revise proxies, rebalance error burdens, tune fairness metrics, build in appeal, create alternative routes, or refuse to deploy a system when its use cannot be justified. Different wrongs call for different repairs, and the wrongs are not always the same in different fields. A hiring gate wrongs people in one way. A hospital triage system wrongs them in another. A dashboard in an advising office wrongs them in a third. Bringing philosophy to these systems means naming the wrong precisely enough that repair has somewhere to start.

<!-- phil-passage-id: ch12-p0108 -->
Diego and Kai are still on that Monday-morning list, sorted and unsorted by a model built with good intentions. Whether the college owes them something different depends on which wrong you find in the case and whether you can defend the diagnosis when someone at the college pushes back. Possible repairs include redesigning the dashboard, using it only as a weak signal, giving students notice and a way to correct their records, adding advising capacity, or withdrawing it from some decisions.

<!-- phil-passage-id: ch12-p0109 -->
Prediction becomes morally non-neutral when an institution treats it as an opportunity gate. A philosopher asks what the system reflects, what it measures, whom it misdescribes, who bears error, who can answer back, and what kind of repair would actually address the wrong.

<!-- phil-section-id: ch12-s013 -->
## References

<!-- phil-passage-id: ch12-p0110 -->
- Alfrink, K., Keller, I., Kortuem, G., & Doorn, N. (2022). [Contestable AI by Design: Towards a Framework](https://link.springer.com/article/10.1007/s11023-022-09611-z). *Minds and Machines*.
- Baker, R. S., & Hawn, A. (2021). [Algorithmic bias in education](https://link.springer.com/article/10.1007/s40593-021-00285-9). *International Journal of Artificial Intelligence in Education*.
- Bang, Y., Chen, D., Lee, N., & Fung, P. (2024). [Measuring Political Bias in Large Language Models: What Is Said and How It Is Said](https://aclanthology.org/2024.acl-long.600/). *Proceedings of ACL 2024*.
- Barocas, S., Hardt, M., & Narayanan, A. [*Fairness and Machine Learning*](https://fairmlbook.org/).
- Buolamwini, J., & Gebru, T. (2018). [Gender Shades: Intersectional Accuracy Disparities in Commercial Gender Classification](https://proceedings.mlr.press/v81/buolamwini18a.html). *Proceedings of Machine Learning Research*.
- Buyl, M., Rogiers, A., Noels, S., Bied, G., Dominguez-Catena, I., Heiter, E., Johary, I., Mara, A.-C., Romero, R., Lijffijt, J., & De Bie, T. (2026). [Large language models reflect the ideology of their creators](https://www.nature.com/articles/s44387-025-00048-0). *npj Artificial Intelligence*.
- Citron, D. K., & Pasquale, F. (2014). [The Scored Society: Due Process for Automated Predictions](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2376209). *Washington Law Review*, 89.
- Creel, K., & Hellman, D. (2022). [The Algorithmic Leviathan: Arbitrariness, Fairness, and Opportunity in Algorithmic Decision-Making Systems](https://www.cambridge.org/core/journals/canadian-journal-of-philosophy/article/algorithmic-leviathan-arbitrariness-fairness-and-opportunity-in-algorithmic-decisionmaking-systems/3AA0ECA77F8622488E9DB0834287215B). *Canadian Journal of Philosophy*.
- Eidelson, B. [*Discrimination and Disrespect*](https://hls.harvard.edu/bibliography/discrimination-and-disrespect/).
- Fishkin, J. R. (2014). [*Bottlenecks: A New Theory of Equal Opportunity*](https://law.utexas.edu/faculty/publications/2015-Bottlenecks-A-New-Theory-of-Equal-Opportunity). Oxford University Press.
- Friedman, B., & Nissenbaum, H. (1996). [Bias in Computer Systems](https://doi.org/10.1145/230538.230561). *ACM Transactions on Information Systems*.
- Gomez, J. F., Machado, C. V., Paes, L. M., & Calmon, F. P. (2024). [Algorithmic Arbitrariness in Content Moderation](https://arxiv.org/html/2402.16979v1). *FAccT 2024*.
- Hellman, D. [*When Is Discrimination Wrong?*](https://digitalcommons.law.umaryland.edu/books/21/).
- Herzog, L. [Algorithmic Bias and Access to Opportunities](https://research.rug.nl/en/publications/algorithmic-bias-and-access-to-opportunities/). In *The Oxford Handbook of Digital Ethics*.
- Jain, S., Suriyakumar, V., Creel, K., & Wilson, A. (2024). [Algorithmic Pluralism: A Structural Approach To Equal Opportunity](https://arxiv.org/abs/2305.08157). *FAccT 2024*.
- Moreau, S. [*Faces of Inequality*](https://academic.oup.com/book/36783/chapter/321925342).
- National Institute of Standards and Technology. (2022). [Towards a Standard for Identifying and Managing Bias in Artificial Intelligence (NIST SP 1270)](https://www.nist.gov/publications/towards-standard-identifying-and-managing-bias-artificial-intelligence).
- Obermeyer, Z., Powers, B., Vogeli, C., & Mullainathan, S. (2019). [Dissecting racial bias in an algorithm used to manage the health of populations](https://doi.org/10.1126/science.aax2342). *Science*.
- Selbst, A. D., Boyd, D., Friedler, S. A., Venkatasubramanian, S., & Vertesi, J. (2019). [Fairness and Abstraction in Sociotechnical Systems](https://doi.org/10.1145/3287560.3287598). *FAccT 2019*.
- Stanford Encyclopedia of Philosophy. [Algorithmic Fairness](https://plato.stanford.edu/entries/algorithmic-fairness/).
- Stanford Encyclopedia of Philosophy. [Discrimination](https://plato.stanford.edu/entries/discrimination/).
- Stanford Encyclopedia of Philosophy. [Distributive Justice](https://plato.stanford.edu/entries/justice-distributive/).
- Stanford Encyclopedia of Philosophy. [Equality of Opportunity](https://plato.stanford.edu/entries/equal-opportunity/).
- Suresh, H., & Guttag, J. (2019/2021). [A Framework for Understanding Sources of Harm throughout the Machine Learning Life Cycle](https://arxiv.org/abs/1901.10002).
- Vallor, S. [*The AI Mirror*](https://academic.oup.com/book/56292). Oxford University Press.
- Young, I. M. [A Social Connection Model](https://academic.oup.com/book/4381/chapter/146336683). In *Responsibility for Justice*.
