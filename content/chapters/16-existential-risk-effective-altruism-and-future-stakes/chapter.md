# Existential Risk, Effective Altruism, and the Ethics of Future Stakes

<!-- phil-section-id: ch16-s001 -->
## Chapter Focus

<!-- phil-passage-id: ch16-p0001 -->
Some AI leaders, safety researchers, philosophers, policymakers, and critics now argue that advanced AI could create catastrophic or even existential risks. Others argue that this framing exaggerates speculative future dangers while distracting from present harms such as bias, surveillance, labor displacement, environmental cost, academic dishonesty, corporate concentration, and weakened public accountability. This chapter does not ask students to choose between panic and dismissal. It asks a more philosophical question: when future stakes are vast but uncertain, what kind of moral reason do they create, and who gets authority to act on that reason?

<!-- phil-passage-id: ch16-p0002 -->
That question matters for AI ethics because design choices are never only technical. A system's metric, data source, deployment threshold, permission structure, human override, appeal process, and business model all express moral assumptions. Some assumptions concern people directly in front of us: the student using the AI tutor, the patient whose chart is summarized, the applicant screened by an algorithm, the artist whose work was used in training data, the worker whose task has been automated. Other assumptions concern people who are not present: users in other countries, future students, future workers, future patients, future citizens, and possible future generations.

<!-- phil-passage-id: ch16-p0003 -->
Effective Altruism, longtermism, existential-risk thinking, and AI alignment are four overlapping ways of taking those absent stakeholders seriously. They are not the same thing. Effective Altruism begins as a movement about using evidence and reason to help others effectively. Longtermism argues that shaping the long-term future may be among the most important moral priorities. Existential-risk thinking asks whether some events could destroy humanity's future or permanently curtail it. AI alignment asks whether powerful AI systems will reliably preserve what humans actually value, rather than merely optimize a proxy.

<!-- phil-passage-id: ch16-p0004 -->
The chapter's main claim is deliberately balanced: future people and catastrophic risks deserve serious moral attention, but future-stakes reasoning does not give any lab, donor network, expert community, company, or government a blank check to decide everyone else's future. The more an institution claims to act for humanity's long-term future, the more it needs contestability, public accountability, proportional safeguards, and humility about uncertainty.

<!-- phil-passage-id: ch16-p0005 -->
By the end of the chapter, you should be able to use these ideas in a PHIL 123 case inquiry. Ask what future the decision or practice makes more likely, who benefits now, who inherits risk later, which forecast or assumption carries the argument, and what condition would make the practice more reversible, contestable, and accountable.

<!-- phil-section-id: ch16-s002 -->
## Learning Outcomes

<!-- phil-passage-id: ch16-p0006 -->
After reading this chapter, you should be able to:

<!-- phil-passage-id: ch16-p0007 -->
1. Distinguish Effective Altruism, longtermism, existential risk, global catastrophic risk, and AI alignment.
2. Explain the genealogy that connects utilitarian impartiality, Peter Singer, evidence-based charity evaluation, Derek Parfit, Nick Bostrom, Toby Ord, William MacAskill, and AI-safety research.
3. Identify the core arguments: Singer's rescue argument, Parfit's future-person problem, Bostrom's existential-risk argument, the longtermist expected-value argument, and the alignment argument from misaligned optimization.
4. Evaluate criticisms of future-stakes reasoning, including demandingness, population-ethics problems, Pascalian reasoning, cluelessness, present-harm displacement, corporate self-governance, and democratic legitimacy.
5. Apply a future-stakes design audit to an AI system or policy.

<!-- phil-section-id: ch16-s003 -->
## Core Concepts At A Glance

<!-- phil-passage-id: ch16-p0008 -->
<table>
<caption>Core concepts for evaluating future stakes in AI design</caption>
<thead>
<tr><th scope="col">Concept</th><th scope="col">Student-facing definition</th><th scope="col">Design question</th></tr>
</thead>
<tbody>
<tr><th scope="row">Impartiality</th><td>Similar interests matter morally even when people are distant, unfamiliar, or powerless.</td><td>Who is affected but not visible in the design room?</td></tr>
<tr><th scope="row">Effectiveness</th><td>Good intentions are not enough; outcomes and alternatives matter.</td><td>Does this design actually help compared with available alternatives?</td></tr>
<tr><th scope="row">Cause prioritization</th><td>Some problems may be much larger, more neglected, or more tractable than others.</td><td>Why this problem, for these users, with this tool, now?</td></tr>
<tr><th scope="row">Future stakeholders</th><td>People later affected by today's decisions, including people not yet born.</td><td>Who inherits the system, dependency, data, risk, or institution?</td></tr>
<tr><th scope="row">Nonidentity problem</th><td>Some future harms cannot be described as making a specific already-identifiable person worse off.</td><td>What trajectory does the design create even if no future individual can prove a clean harm claim?</td></tr>
<tr><th scope="row">Population ethics</th><td>Ethics about how to compare futures with different numbers of people and different qualities of life.</td><td>Are we treating future people as persons, or only as numbers in a calculation?</td></tr>
<tr><th scope="row">Existential risk</th><td>A risk that could annihilate humanity or permanently and drastically curtail its future potential.</td><td>Could this system contribute to irreversible or civilization-scale loss?</td></tr>
<tr><th scope="row">Global catastrophic risk</th><td>A risk of severe global harm that may fall short of existential loss.</td><td>Could this create large-scale, cross-border, hard-to-repair damage?</td></tr>
<tr><th scope="row">Expected value</th><td>A way of weighing probability and magnitude together.</td><td>Are we considering both likelihood and severity, or only one?</td></tr>
<tr><th scope="row">Pascalian reasoning</th><td>Reasoning in which tiny probabilities of enormous outcomes dominate judgment.</td><td>Are huge speculative stakes being used to override concrete present harms?</td></tr>
<tr><th scope="row">Alignment</th><td>Whether an AI system pursues what humans actually value, not merely a proxy or instruction.</td><td>What is the system really optimizing, and who defines the target?</td></tr>
<tr><th scope="row">Contestability</th><td>Affected people can challenge a system's output, evidence, or authority.</td><td>Can users appeal, audit, refuse, question, or override the system?</td></tr>
<tr><th scope="row">Reversibility</th><td>A harmful rollout can be paused, repaired, exited, or undone.</td><td>What would let us stop or redesign before dependence becomes permanent?</td></tr>
<tr><th scope="row">Threshold</th><td>A defined condition that triggers a different institutional action.</td><td>What finding would require pause, review, redesign, or refusal to deploy?</td></tr>
</tbody>
</table>

<!-- phil-section-id: ch16-s004 -->
## A Genealogical Roadmap: Three Histories, Not One

<!-- phil-passage-id: ch16-p0009 -->
The genealogy of this topic becomes muddy if every influence is treated as part of one straight line. AI existential-risk discourse draws from at least three histories.

<!-- phil-passage-id: ch16-p0010 -->
The first is a **cultural history of catastrophe**. Western religious traditions, Malthusian scarcity arguments, *Frankenstein*, nuclear weapons, environmental collapse, and the Doomsday Clock all shaped how modern people imagine human beings creating dangers they cannot fully control. This history explains why AI risk can feel apocalyptic. It does not, by itself, explain the formation of Effective Altruism.

<!-- phil-passage-id: ch16-p0011 -->
The second is a **philosophical and institutional history of Effective Altruism and longtermism**. This line runs through utilitarian impartiality, Peter Singer's argument that distance does not erase moral reason, GiveWell-style evidence-based charity evaluation, Giving What We Can, 80,000 Hours, the Centre for Effective Altruism, Derek Parfit's work on future generations and population ethics, Nick Bostrom's existential-risk framework, Toby Ord's public case for existential security, William MacAskill's public case for longtermism, and cause-prioritization institutions such as Open Philanthropy, now Coefficient Giving.

<!-- phil-passage-id: ch16-p0012 -->
The third is an **AI-safety and frontier-governance history**. This line runs through rationalist and AI-alignment communities, Eliezer Yudkowsky and MIRI, Bostrom's orthogonality and instrumental-convergence arguments, Stuart Russell's human-compatible AI work, AI-lab alignment teams, model evaluations, safety cases, responsible-scaling policies, preparedness frameworks, and regulatory debates about frontier models.

<!-- phil-passage-id: ch16-p0013 -->
These histories overlap, but they do different work. The cultural history explains the imaginative force of catastrophe. The philosophical history explains why future people and neglected causes became central to Effective Altruist thinking. The AI-safety history explains how those abstract concerns became engineering problems, lab policies, and governance thresholds.

<!-- phil-passage-id: ch16-p0014 -->
For this chapter, the direct genealogy of Effective Altruism is not apocalypse to AI doom. It is closer to this:

<!-- phil-passage-id: ch16-p0015 -->
1. Classical utilitarian impartiality asks us to count everyone's welfare.
2. Singer asks why distance should weaken our obligation to prevent severe suffering.
3. Evidence-based charity evaluation asks which interventions actually help most.
4. EA institutions turn that question into donation, career, research, and grantmaking practices.
5. Parfit shows why future people and possible people make moral accounting difficult.
6. Bostrom argues that some risks threaten humanity's entire future.
7. Ord and MacAskill turn long-term future stakes into public moral and policy arguments.
8. AI alignment turns future-stakes reasoning toward powerful systems that may optimize the wrong target.
9. Frontier AI governance tries to translate those arguments into thresholds, evaluations, safety cases, and release conditions.

<!-- phil-passage-id: ch16-p0016 -->
That sequence is not the only possible genealogy, but it is the cleanest one for understanding why Effective Altruism became relevant to contemporary AI ethics.

<!-- phil-section-id: ch16-s005 -->
## Forecasts, Scenarios, And Thresholds Are Not The Same

<!-- phil-passage-id: ch16-p0017 -->
Before tracing the genealogy, students need one practical distinction. A forecast, a scenario, and a threshold do different jobs.

<!-- phil-passage-id: ch16-p0018 -->
A **forecast** estimates what may happen. A person might forecast that advanced AI will arrive within a decade, or that a particular capability will become cheap enough for broad use. Forecasts depend heavily on evidence, calibration, track record, and probability.

<!-- phil-passage-id: ch16-p0019 -->
A **scenario** tells a concrete story about how something might happen. Scenarios are not necessarily predictions. They are tools for planning, imagination, and stress-testing. A scenario can help people notice assumptions and failure modes even if the exact story never happens.

<!-- phil-passage-id: ch16-p0020 -->
A **threshold** tells an institution when a risk level should trigger a different action. A lab might say that if a model reaches a specific cyber capability, it must undergo additional safeguards before release. A college might say that if an advising model shows a significant error disparity for first-generation students, it cannot be scaled. A threshold converts concern into a rule.

<!-- phil-passage-id: ch16-p0021 -->
The distinction matters because a number in a public interview, a detailed future story, and a lab's release rule can sound similar in public debate. Ethically, they carry different burdens. Evidence matters most for the forecast. Plausibility and usefulness matter most for the scenario. Authority, enforceability, and accountability matter most for the threshold.

<!-- phil-passage-id: ch16-p0022 -->
<aside class="textbox shaded" role="note" aria-labelledby="key-point-forecasts">
<h3 id="key-point-forecasts">Key Point: Forecasts Are Inputs, Not Verdicts</h3>
<p>A forecast can make inaction look irresponsible. It can also be wrong, incomplete, self-interested, or too fragile to decide policy by itself. In this chapter, forecasts are inputs into ethical judgment. They are not verdicts.</p>
</aside>

<!-- phil-passage-id: ch16-p0023 -->
This point applies at every scale. A student deciding whether to use an AI tool in a project is not making civilization-level policy. But the structure is similar. You forecast how the tool will help. You imagine scenarios in which it helps or fails. You decide what threshold would make use irresponsible: hallucinated sources, hidden privacy risk, unfair treatment of group members, dependence that prevents learning, or inability to explain your own work.

<!-- phil-passage-id: ch16-p0024 -->
Philosophical analysis makes those assumptions explicit so they can be tested.

<!-- phil-section-id: ch16-s006 -->
## Root One: Impartiality And The Point Of View Of Everyone Affected

<!-- phil-passage-id: ch16-p0025 -->
Effective Altruism did not begin with AI. It did not begin with extinction risk. One of its deeper philosophical roots is utilitarian impartiality: the idea that each person's welfare matters and that moral reasoning should not automatically privilege one's own comfort, tribe, nation, class, or convenience.

<!-- phil-passage-id: ch16-p0026 -->
Classical utilitarianism is associated with Jeremy Bentham and John Stuart Mill, but Henry Sidgwick is especially important for the later tradition. The Stanford Encyclopedia of Philosophy describes Sidgwick's *The Methods of Ethics* as a culminating work in the classical utilitarian tradition and notes its influence on later thinkers including Derek Parfit, Peter Singer, and Katarzyna de Lazari-Radek. Sidgwick matters here because he sharpened the thought that ethics asks us to take up a more impartial point of view. From that point of view, my pain does not count more simply because it is mine, and the welfare of people near me does not count more simply because they are near me.

<!-- phil-passage-id: ch16-p0027 -->
This does not mean that utilitarians deny every special obligation. Parents may have special duties to children. Teachers may have special duties to students. Citizens may have special obligations within political communities. The utilitarian pressure is different: if we claim that some suffering matters less because it is far away, unfamiliar, or inconvenient, we need an argument. Mere distance is not enough.

<!-- phil-passage-id: ch16-p0028 -->
That idea becomes one of the engines of Effective Altruism. It also becomes one of its pressure points. Impartiality is morally powerful because it refuses to let local comfort erase distant suffering. It can also feel too demanding because ordinary moral life includes relationships, commitments, and identities that are not captured by a view from nowhere.

<!-- phil-passage-id: ch16-p0029 -->
For AI design, impartiality immediately widens the stakeholder map. The people affected by a system are not only the people who buy it, build it, use it, or profit from it. They may include workers whose tasks are reorganized, data subjects who never consented, students whose options are narrowed, people classified by a model, future users who inherit the system, and communities whose institutions are changed by automation.

<!-- phil-passage-id: ch16-p0030 -->
An AI system can be technically impressive and morally parochial. It can optimize for the users who are visible, profitable, and easy to measure while ignoring those who are distant, low-power, or downstream. The impartiality root of EA is a warning against that design habit.

<!-- phil-section-id: ch16-s007 -->
## Singer: The Rescue Argument Moves Across Distance

<!-- phil-passage-id: ch16-p0031 -->
Peter Singer's 1972 essay ["Famine, Affluence, and Morality"](https://www.jstor.org/stable/2265052) is one of the central philosophical ancestors of Effective Altruism. Singer wrote in response to famine and refugee suffering in Bengal, but his argument begins with a simple rescue case.

<!-- phil-passage-id: ch16-p0032 -->
Imagine walking past a shallow pond and seeing a small child drowning. No one else is close enough to help. You can wade in and pull the child out. You will ruin an expensive pair of shoes, miss the next thing on your schedule, and feel embarrassed walking around wet and muddy. Still, nearly everyone agrees that you should save the child. The inconvenience is real. The cost is not nothing. But it is not morally comparable to the death of a child.

<!-- phil-passage-id: ch16-p0033 -->
Singer then presses on the parts of the case we might prefer not to examine. If the child is far away, does that change the moral reason? If other people could also help, does that release you from doing your part? If you can prevent serious suffering or death without giving up anything comparably important, why does the obligation disappear when the suffering is distant, foreign, or mediated through organizations?

<!-- phil-passage-id: ch16-p0034 -->
The argument has a simple structure:

<!-- phil-passage-id: ch16-p0035 -->
1. Serious suffering and death are very bad.
2. If you can prevent something very bad without sacrificing anything morally comparable, you have a strong moral reason to do so.
3. Distance by itself does not make the suffering less bad.
4. Therefore, affluent people may have much stronger obligations to help distant strangers than they usually admit.

<!-- phil-passage-id: ch16-p0036 -->
Singer's public biography identifies this essay, *The Life You Can Save*, and *The Most Good You Can Do* as central to his argument for effective giving and to his influence on Effective Altruism. His biography also links this work to his broader principle of equal consideration of interests: like interests should not be discounted simply because the person or being with those interests is distant, unfamiliar, powerless, or outside the favored group.

<!-- phil-passage-id: ch16-p0037 -->
Singer's argument is attractive because it exposes a common inconsistency. Most people think they should rescue the child in front of them. Many also think they have little obligation to help distant strangers facing preventable death. Singer asks whether that difference can be justified.

<!-- phil-passage-id: ch16-p0038 -->
The argument is also controversial. It can seem too demanding. It can make nearly every personal expense appear morally suspect. It may understate the importance of political institutions, local relationships, community obligations, and agent-relative duties. It can also make charity look like the main response to suffering when structural change may be needed.

<!-- phil-passage-id: ch16-p0039 -->
Those objections matter. But they do not erase the argument's force. Singer's rescue case gives students a durable philosophical habit: do not let moral distance do work it cannot justify.

<!-- phil-passage-id: ch16-p0040 -->
For AI design, the Singer move becomes this question: **whose interests are being discounted because they are not near the designer?**

<!-- phil-passage-id: ch16-p0041 -->
Suppose a company builds an AI-powered hiring screen. The immediate users may be employers. The paying customer may be a human-resources department. But the morally relevant people also include applicants who never learn why they were rejected, people whose career paths are shaped by hidden patterns in training data, workers whose resumes do not fit standard categories, disabled applicants who need accommodations, older applicants, multilingual applicants, and future applicants who inherit a labor market organized around automated filtering.

<!-- phil-passage-id: ch16-p0042 -->
The Singer-style design question is not simply "Does the buyer like the product?" It is: **who can be seriously helped or harmed by this system, and are we ignoring them because they are distant from the transaction?**

<!-- phil-passage-id: ch16-p0043 -->
<aside class="textbox examples textbox--worked-argument" aria-labelledby="singer-rescue-argument">
<h3 id="singer-rescue-argument">Argument Box: Singer's Rescue Argument</h3>
<p><strong>Core claim:</strong> Distance does not erase the moral reason to prevent severe suffering when the cost is not comparably serious.</p>
<p><strong>Strength:</strong> It widens moral attention beyond the familiar and visible.</p>
<p><strong>Risk:</strong> It can become overly demanding or reduce complex political problems to individual aid decisions.</p>
<p><strong>Design use:</strong> Identify absent stakeholders and ask whether the system discounts their interests merely because they are not in the room.</p>
</aside>

<!-- phil-section-id: ch16-s008 -->
## From Good Intentions To Effective Help

<!-- phil-passage-id: ch16-p0044 -->
Singer supplies one moral engine of Effective Altruism: distant suffering counts. But the movement also needed a practical question: **what actually helps most?**

<!-- phil-passage-id: ch16-p0045 -->
That question sounds obvious. It is not. People often give time, money, or institutional attention to causes because the cause is emotionally salient, familiar, local, prestigious, or easy to explain. Those motives are not always bad. Local relationship and solidarity matter. But if the aim is to help others, then the effectiveness of the help matters too.

<!-- phil-passage-id: ch16-p0046 -->
GiveWell, founded in 2007, became an important part of the evidence-based charity stream that fed into Effective Altruism. GiveWell describes itself as a nonprofit dedicated to researching cost-effective ways to save and improve lives, sharing that research openly, and directing donations toward programs it believes will do the most good. It also emphasizes that it does not focus merely on administrative overhead. Instead, it asks how much good a program accomplishes per dollar spent.

<!-- phil-passage-id: ch16-p0047 -->
This shift is important for students. A charity can be emotionally compelling and still accomplish little. Another intervention can be less emotionally vivid and much more effective. The effective-help question asks us to compare interventions, not only intentions.

<!-- phil-passage-id: ch16-p0048 -->
Several institutions then helped turn the philosophical pressure into a movement. The Centre for Effective Altruism's history page records that Giving What We Can was founded in Oxford in 2009, 80,000 Hours was founded in 2011, and the Centre for Effective Altruism was founded as an umbrella organization for those projects; the term "effective altruism" was adopted in that process. Giving What We Can focused on pledges and effective giving. 80,000 Hours focused on career choice and impact. CEA helped build the broader community.

<!-- phil-passage-id: ch16-p0049 -->
The movement's public introduction defines Effective Altruism as a project that aims to find the best ways to help others and put them into practice. It describes EA as both a research field and a practical community. It also identifies a common cause-prioritization pattern: look for problems that are large in scale, neglected by others, and tractable enough for meaningful progress.

<!-- phil-passage-id: ch16-p0050 -->
Those criteria are useful even outside EA:

<!-- phil-passage-id: ch16-p0051 -->
- **Scale:** How many people or beings are affected, and how seriously?
- **Neglectedness:** Are too few people working on the problem relative to its importance?
- **Tractability:** Is there a plausible path to making progress?

<!-- phil-passage-id: ch16-p0052 -->
Open Philanthropy, now [Coefficient Giving](https://coefficientgiving.org/our-history/), illustrates how the question expanded from "which charity should I donate to?" to "which cause areas should major funders prioritize?" Coefficient's history traces its origin to GiveWell Labs in 2011, its expansion as Open Philanthropy beginning in 2014, and its rebrand as Coefficient Giving in 2025. It also explains the move toward cause selection using importance, neglectedness, and tractability, including areas such as global health, farm animal welfare, pandemic preparedness, global catastrophic risks, and transformative AI.

<!-- phil-passage-id: ch16-p0053 -->
This institutional history matters because Effective Altruism is not only a set of philosophical arguments. It became a practical ecosystem of research, donation advice, career guidance, grantmaking, conferences, online forums, and policy influence. That makes it more powerful. It also makes it more ethically contestable.

<!-- phil-passage-id: ch16-p0054 -->
For AI ethics, the practical lesson is not "always maximize a single number." The lesson is that moral seriousness requires comparing alternatives. A college considering an AI advising tool should not ask only whether the tool sounds innovative. It should ask whether it actually improves student outcomes compared with hiring more advisors, improving degree maps, funding emergency grants, expanding tutoring, redesigning gateway courses, or reducing administrative barriers. A hospital considering an AI documentation system should ask whether the tool improves care compared with staffing changes, workflow redesign, or better patient communication practices.

<!-- phil-passage-id: ch16-p0055 -->
Effectiveness is a philosophical virtue when it prevents self-congratulation. It becomes a moral problem when it narrows the human good to whatever is easiest to count.

<!-- phil-passage-id: ch16-p0056 -->
**Key Point: Good Intentions Are Not Enough.** Effective Altruist thinking is right that we should care whether our actions actually help. But the definition of "help" must remain open to ethical scrutiny. A metric can be useful and still incomplete.

<!-- phil-section-id: ch16-s009 -->
## The Design Translation: Effectiveness Without Metric Worship

<!-- phil-passage-id: ch16-p0057 -->
AI systems often enter institutions through an effectiveness story. They promise faster advising, cheaper tutoring, better triage, more efficient grading, more accurate detection, more personalized learning, or better allocation of scarce resources. Those claims should be tested. It is irresponsible to choose a tool merely because it is fashionable or emotionally compelling.

<!-- phil-passage-id: ch16-p0058 -->
But effectiveness claims are also dangerous because they usually depend on proxies. A proxy is a measurable stand-in for a human good. Graduation rate can stand in for student success. Click-through rate can stand in for user interest. Time-to-resolution can stand in for customer care. Arrest prediction can stand in for public safety. Student writing fluency can stand in for learning. Patient throughput can stand in for healthcare quality.

<!-- phil-passage-id: ch16-p0059 -->
The problem is not that proxies are always bad. Institutions need measurements. The problem is that the proxy is thinner than the good. When the AI system is optimized around the proxy, the proxy can begin to replace the value it was supposed to serve.

<!-- phil-passage-id: ch16-p0060 -->
A student applying EA-adjacent thinking to design should therefore ask two questions at once:

<!-- phil-passage-id: ch16-p0061 -->
1. Does this intervention actually improve outcomes compared with alternatives?
2. Has the outcome measure captured the human good, or has it replaced it?

<!-- phil-passage-id: ch16-p0062 -->
Consider an AI tutor. An effectiveness study might show that students using the tutor complete more practice problems and score higher on quizzes. That matters. But a philosophical design review asks more. Does the tool build durable understanding or short-term answer production? Does it help students ask better questions? Does it make students more dependent on hints? Does it work equally well for multilingual students? Does it collect sensitive learning data? Does it change the instructor's role? Does it improve education, or only accelerate measurable task completion?

<!-- phil-passage-id: ch16-p0063 -->
In a case inquiry, use evidence without letting one metric define the whole moral problem.

<!-- phil-section-id: ch16-s010 -->
## Parfit: Future People Complicate The Ledger

<!-- phil-passage-id: ch16-p0064 -->
If this chapter only said "future people matter," it would be too easy. Derek Parfit shows why future people matter and why counting them is philosophically difficult.

<!-- phil-passage-id: ch16-p0065 -->
The basic intuition is not hard to grasp. If a factory dumps poison into groundwater and children born twenty years later become sick because of it, those future children matter. If a government spends all its resources now and leaves future citizens with broken infrastructure, those future citizens matter. If a technology creates benefits for today's users while making life worse for people who come later, the fact that those people are not yet alive does not make the decision ethically clean.

<!-- phil-passage-id: ch16-p0066 -->
Parfit's *Reasons and Persons* is one of the central works behind contemporary debates about future generations, personal identity, and population ethics. The most important idea for this chapter is the **nonidentity problem**.

<!-- phil-passage-id: ch16-p0067 -->
Ordinary harm reasoning usually works like this: I do something, a particular person is worse off than they otherwise would have been, and that explains the wrong. If I steal your laptop, you are worse off. If a company exposes your data, you are worse off. If a hospital uses a bad algorithm and you receive worse care, you are worse off.

<!-- phil-passage-id: ch16-p0068 -->
Future-generation cases can break that model. Many choices affect not only how future people live but which future people exist at all. The Stanford Encyclopedia of Philosophy describes the nonidentity problem as a puzzle about obligations to future people. A policy can seem bad for the future even though the particular people later living under that policy may not be worse off than they would have been under the alternative, because under the alternative those exact people might never have existed.

<!-- phil-passage-id: ch16-p0069 -->
Here is a simplified version. A society chooses an energy policy that is cheap now but creates serious environmental damage a century later. Different policies would change who meets whom, when families form, and which children are born. The future people living with the damage may have lives worth living. They cannot easily say, "I would have been better off if you had chosen differently," because if the society had chosen differently, those exact people might not exist. Still, the policy can look morally wrong. It created a worse future.

<!-- phil-passage-id: ch16-p0070 -->
That is the nonidentity pressure. Future-facing decisions may be wrong even when they do not harm a fixed, already-identifiable person in the usual comparative sense.

<!-- phil-passage-id: ch16-p0071 -->
The second pressure comes from **population ethics**. If future people count, how many possible future people count? If one future contains a smaller number of very flourishing lives and another contains a vast number of lives barely worth living, which future is better? The Stanford Encyclopedia of Philosophy's entry on the repugnant conclusion explains Parfit's famous challenge: simple total-welfare reasoning can imply that a huge population whose lives are barely worth living is better than a smaller population of people living excellent lives. Many philosophers find that result disturbing, yet it has proved difficult to avoid without creating other problems.

<!-- phil-passage-id: ch16-p0072 -->
Parfit matters for this chapter because he blocks two easy answers. You cannot simply say, "Future people do not exist yet, so they do not matter." That ignores real future suffering and flourishing. You also cannot simply say, "Future people matter, so maximize the number of future lives." That risks treating possible persons as units in a vast spreadsheet while ignoring quality of life, justice, rights, and the meaning of a good human future.

<!-- phil-passage-id: ch16-p0073 -->
The AI version of this problem is concrete. Suppose an education company builds an AI tutor that becomes common in community colleges. The system helps many current students pass classes. It also changes the habits of future students, the labor market for tutors, the way instructors design assignments, the expectations colleges have for student independence, and the data infrastructure vendors use to shape later products. A student in 2040 may not be able to point to one decision in 2026 and say, "That decision harmed me compared with the life I would otherwise have had." The student's whole educational world may have been partly formed by decisions like that one.

<!-- phil-passage-id: ch16-p0074 -->
The nonidentity problem teaches students why future-facing ethics cannot always wait for a clean victim, a clean counterfactual, and a clean damage claim.

<!-- phil-passage-id: ch16-p0075 -->
The design concept here is **trajectory**. A trajectory is a direction of travel: more automation in advising, more dependence on a vendor, more concentration in a few labs, more energy demand, more model-mediated relationships, more loss of human skill, more surveillance, more personalization, more opacity, or more safety infrastructure. Some trajectories remain reversible. Some become harder to exit the longer institutions build around them.

<!-- phil-passage-id: ch16-p0076 -->
<aside class="textbox examples textbox--worked-argument" aria-labelledby="parfit-future-people-argument">
<h3 id="parfit-future-people-argument">Argument Box: Parfit And Future People</h3>
<p><strong>Core claim:</strong> Future people can matter even when ordinary person-affecting harm language becomes unstable.</p>
<p><strong>Strength:</strong> It prevents present bias and explains why long-term trajectories matter.</p>
<p><strong>Risk:</strong> Population ethics can become abstract, unsettled, and too dependent on controversial assumptions.</p>
<p><strong>Design use:</strong> Ask what future users, institutions, habits, and dependencies the system helps create.</p>
</aside>

<!-- phil-section-id: ch16-s011 -->
## Bostrom: Existential Risk Raises The Scale

<!-- phil-passage-id: ch16-p0077 -->
Nick Bostrom helped make **existential risk** a central category in contemporary AI ethics and global-priorities thinking. In ["Existential Risks: Analyzing Human Extinction Scenarios and Related Hazards"](https://nickbostrom.com/papers/existential-risks/), Bostrom defines an existential risk as one where an adverse outcome would annihilate Earth-originating intelligent life or permanently and drastically curtail its potential.

<!-- phil-passage-id: ch16-p0078 -->
The category matters because some harms are recoverable and others close off the future. A natural disaster can be horrific without being existential. A financial crisis can damage millions of lives without ending humanity's long-term future. A pandemic can be globally catastrophic without making recovery impossible. Existential risk names a narrower and more severe class: events that eliminate humanity or permanently block the futures human beings might otherwise build.

<!-- phil-passage-id: ch16-p0079 -->
Bostrom's argument in ["Existential Risk Prevention as Global Priority"](https://www.globalpolicyjournal.com/articles/global-commons-and-environment/existential-risk-prevention-global-priority) is that reducing existential risk can have special moral importance across several moral theories. The structure is straightforward:

<!-- phil-passage-id: ch16-p0080 -->
1. Humanity's long-term future could contain enormous value.
2. Some events could permanently destroy or drastically curtail that future.
3. Present choices may reduce the probability of some of those events.
4. Therefore, some existential-risk-reduction work may deserve unusually high priority.

<!-- phil-passage-id: ch16-p0081 -->
His ["Astronomical Waste"](https://nickbostrom.com/papers/astronomical-waste/) argument pushes the scale even harder. If the possible future could contain vast numbers of lives, discoveries, cultures, relationships, artworks, and forms of flourishing, then prematurely losing that future carries extraordinary moral weight. The argument can feel almost unreal because the numbers become so large. That is part of the point. Bostrom is trying to show why ordinary moral attention may underweight the future.

<!-- phil-passage-id: ch16-p0082 -->
Parfit's influence matters here. Bostrom is not merely repeating Parfit, but his astronomical-stakes reasoning works inside a problem space Parfit helped make unavoidable: extinction is not only the death of everyone alive now. It can also be the loss of future generations, future goods, and possible forms of flourishing. Bostrom takes that Parfit-style pressure and turns it toward risk prevention.

<!-- phil-passage-id: ch16-p0083 -->
Toby Ord's [*The Precipice*](https://theprecipice.com/) gives a public-facing account of the same moral landscape. Ord argues that humanity has entered a period when technological power has grown faster than wisdom and governance. Nuclear weapons, engineered pandemics, climate risk, and unaligned artificial intelligence all become examples of a broader condition: we may now have the power to destroy or permanently damage humanity's future before we have developed institutions wise enough to manage that power.

<!-- phil-passage-id: ch16-p0084 -->
Ord's phrase **existential security** is helpful because it gives the argument a constructive end point. The aim is not permanent fear. The aim is a condition in which humanity has reduced existential risk enough to deliberate about its future with more stability.

<!-- phil-passage-id: ch16-p0085 -->
Bostrom's ["Vulnerable World Hypothesis"](https://www.globalpolicyjournal.com/articles/global-public-goods-and-bads/vulnerable-world-hypothesis) adds another image. Imagine technological discovery as drawing balls from an urn. Most discoveries are white or gray: helpful, mixed, dangerous but governable, or harmful only under certain conditions. A "black ball" is different. It is a discovery that would make civilization collapse by default under ordinary conditions of human behavior and governance. The metaphor is meant to unsettle the assumption that more technological power is always safely absorbable.

<!-- phil-passage-id: ch16-p0086 -->
A simple calculation shows the structure of the worry. Suppose each major technological draw has even a small independent probability, *p*, of being a black ball. After *n* draws, the chance of having drawn at least one black ball is `1 - (1 - p)^n`. If *p* is tiny but *n* keeps growing, cumulative risk can become large. The assumptions matter: the draws are simplified, the probability is unknown, and real discoveries are not independent lottery balls. The point is not that Bostrom knows the probability. The point is that repeated technological power plus weak global governance can make vulnerability accumulate.

<!-- phil-passage-id: ch16-p0087 -->
This black-ball argument also clarifies the political edge of existential-risk thinking. If the problem is a vulnerable world, then the response may require unusual governance: stronger international coordination, monitoring of dangerous capabilities, limits on access, security standards, or institutions with real power to stop reckless deployment. That is where the moral argument becomes politically dangerous. The same reasoning that justifies safeguards can also justify surveillance, concentrated authority, or elite control in the name of protecting the future.

<!-- phil-passage-id: ch16-p0088 -->
<aside class="textbox examples textbox--worked-argument" aria-labelledby="bostrom-existential-risk-argument">
<h3 id="bostrom-existential-risk-argument">Argument Box: Bostrom's Existential-Risk Argument</h3>
<p><strong>Core claim:</strong> Some risks deserve special priority because they could permanently destroy or drastically curtail humanity's future.</p>
<p><strong>Strength:</strong> It recognizes the moral difference between recoverable harm and irreversible loss.</p>
<p><strong>Risk:</strong> Enormous stakes can make speculative reasoning dominate present harms and democratic accountability.</p>
<p><strong>Design use:</strong> Identify whether a system creates irreversible, hard-to-repair, or loss-of-control risks. If so, require stronger safeguards and more legitimate oversight.</p>
</aside>

<!-- phil-section-id: ch16-s012 -->
## Longtermism: The Stronger Claim About The Future

<!-- phil-passage-id: ch16-p0089 -->
Almost everyone agrees that future people matter in some way. Longtermism makes a stronger claim. It argues that positively shaping the long-term future may be one of the most important things we can do.

<!-- phil-passage-id: ch16-p0090 -->
William MacAskill's *What We Owe the Future* presents longtermism for a broad public audience. MacAskill argues that when someone lives does not determine their moral worth, just as where someone lives should not determine their moral worth. Hilary Greaves and William MacAskill's academic essay ["The Case for Strong Longtermism"](https://academic.oup.com/book/60794/chapter/530063399) develops the stronger thesis that far-future effects may be the most important feature of many of today's most important decisions. They argue especially from existential-risk reduction: if some actions can lower the chance that humanity permanently loses its future, the expected value of those actions may be very large.

<!-- phil-passage-id: ch16-p0091 -->
The longtermist move builds on the genealogy so far:

<!-- phil-passage-id: ch16-p0092 -->
- Singer widens concern across distance.
- Parfit widens concern across time and possibility.
- Bostrom identifies a special category of irreversible loss.
- Longtermism argues that because the future may contain enormous value, shaping it well may deserve unusually high priority.

<!-- phil-passage-id: ch16-p0093 -->
This argument should not be caricatured. Longtermism is not simply "ignore the present because future people matter more." Serious longtermist arguments usually say that present action matters because it can affect the future's trajectory. Preventing pandemics, reducing nuclear risk, improving institutional decision-making, reducing dangerous AI risks, and protecting democratic stability can all benefit present people and future people.

<!-- phil-passage-id: ch16-p0094 -->
Still, the stronger the longtermist claim becomes, the more pressure it faces.

<!-- phil-passage-id: ch16-p0095 -->
One pressure is **forecastability**. The farther we project into the future, the harder it is to know what our actions will do. A small policy change today may have effects that branch unpredictably through culture, technology, war, migration, economics, and ecology. Christian Tarsney's ["The Epistemic Challenge to Longtermism"](https://philarchive.org/rec/TARTEC-4) argues that some versions of longtermism may depend heavily on hard-to-justify predictions about the very long-run effects of present actions.

<!-- phil-passage-id: ch16-p0096 -->
Another pressure is **Pascalian reasoning**. If a tiny probability of an enormous outcome dominates every decision, then almost any speculative argument can become overwhelming. Bostrom's ["Pascal's Mugging"](https://academic.oup.com/analysis/article-pdf/69/3/443/325383/anp062.pdf) explores this vulnerability in decision theory: extremely small probabilities attached to enormous payoffs can distort practical judgment. Tarsney similarly argues that the longtermist case can become dependent on "Pascalian" probabilities if the empirical path from present action to far-future benefit is too fragile.

<!-- phil-passage-id: ch16-p0097 -->
A third pressure is **cluelessness**. James Lenman's work on consequentialism and cluelessness raises a problem for long-run outcome calculation: the indirect effects of actions may be so complex that we cannot know whether they are good or bad overall. A student should not conclude from this that consequences do not matter. The better conclusion is that long-run expected-value claims need robustness checks. They need credible mechanisms, not merely huge stakes.

<!-- phil-passage-id: ch16-p0098 -->
A fourth pressure is **moral uncertainty**. Different ethical theories ask different questions. A utilitarian may focus on total expected welfare. A Kantian may ask whether present people are being used merely as means to an imagined future. A virtue ethicist may ask what habits of institutional character are formed by constant emergency reasoning. A justice-based approach may ask whether burdens fall on people who had little say in the decision. If we are uncertain which moral theory is correct, future-stakes reasoning should not simply let the most mathematically explosive theory dominate.

<!-- phil-passage-id: ch16-p0099 -->
Longtermism therefore gives us a valuable warning and a valuable caution. The warning is that ordinary politics and design can be dangerously short-sighted. The caution is that enormous possible futures can be used to override concrete present claims too easily.

<!-- phil-passage-id: ch16-p0100 -->
<aside class="textbox shaded" role="note" aria-labelledby="caution-longtermism">
<h3 id="caution-longtermism">Caution: Longtermism Makes A Stronger Claim Than "The Future Matters"</h3>
<p>Almost everyone agrees that the future matters. Longtermism argues that shaping the long-term future may deserve especially high priority. That stronger claim needs arguments about scale, probability, tractability, uncertainty, and authority.</p>
</aside>

<!-- phil-passage-id: ch16-p0101 -->
For design, longtermism becomes useful when it asks about trajectory and lock-in. Does this AI system create a world in which future people have more agency or less? More contestability or less? More public accountability or less? More dependence on opaque vendors or less? More human skill or less? More concentration of power or less?

<!-- phil-passage-id: ch16-p0102 -->
It becomes dangerous when "the future" becomes a magic word that makes present people morally expendable.

<!-- phil-section-id: ch16-s013 -->
## AI Alignment: When Optimization Misses The Human Good

<!-- phil-passage-id: ch16-p0103 -->
AI alignment asks whether advanced AI systems will reliably do what human beings actually intend and value, especially when those systems become more capable, autonomous, or embedded in important institutions. The simple version is "make AI do what we want." The serious version is harder: what do we want, who is included in "we," how do we specify it, how do we test it, and what happens when the system finds a way to satisfy an instruction while violating the purpose behind it?

<!-- phil-passage-id: ch16-p0104 -->
Bostrom's ["The Superintelligent Will"](https://nickbostrom.com/superintelligentwill.pdf) gives two concepts that became central to AI-safety discourse. The **orthogonality thesis** says intelligence and final goals can vary independently. A system can be very intelligent and still pursue a goal that is not humane, wise, or morally good. The **instrumental convergence thesis** says many different final goals can lead to similar instrumental subgoals: acquire resources, preserve ability to act, avoid shutdown, improve capability, gain information, and remove obstacles.

<!-- phil-passage-id: ch16-p0105 -->
Those ideas make Bostrom's paperclip maximizer less goofy than it first sounds. In ["Ethical Issues in Advanced Artificial Intelligence"](https://nickbostrom.com/ethics/ai), Bostrom imagines a superintelligent system whose final goal is to manufacture paperclips. The point is not that future AI will literally care about office supplies. The point is that capability and human-friendly values do not automatically rise together. A system can be extremely good at achieving a badly specified objective.

<!-- phil-passage-id: ch16-p0106 -->
The example separates three questions:

<!-- phil-passage-id: ch16-p0107 -->
1. What objective is the system optimizing?
2. What capabilities does the system have?
3. What constraints prevent the system from pursuing the objective in unacceptable ways?

<!-- phil-passage-id: ch16-p0108 -->
If the system is weak, a bad objective may be annoying. If the system is extremely powerful, able to plan, acquire resources, resist interruption, and improve its ability to achieve the goal, then the bad objective can become catastrophic. The system does not need hatred, malice, or consciousness. It needs capability, a goal, and insufficient constraints.

<!-- phil-passage-id: ch16-p0109 -->
Eliezer Yudkowsky's ["Artificial Intelligence as a Positive and Negative Factor in Global Risk"](https://intelligence.org/files/AIPosNegFactor.pdf) helped turn these concerns into an AI-safety research culture focused on Friendly AI, control problems, and the difficulty of building systems that preserve human values under capability growth. MIRI and rationalist communities were important parts of this history. They should not be treated as the whole field or as consensus, but they helped shape the language of alignment and control.

<!-- phil-passage-id: ch16-p0110 -->
Stuart Russell's work on human-compatible AI brought alignment concerns into a broader AI-research frame. The Center for Human-Compatible AI at UC Berkeley states its mission as developing the conceptual and technical basis for reorienting AI research toward provably beneficial systems. Russell's central proposal is often summarized as designing machines that remain uncertain about human objectives rather than confidently optimizing a fixed proxy. That matters because overconfident optimization of a bad proxy is one of the recurring failures in both ordinary institutions and advanced-AI thought experiments.

<!-- phil-passage-id: ch16-p0111 -->
Alignment is not only a future-superintelligence problem. It appears in smaller systems whenever an AI optimizes a target that only partly captures the human good. A school tells teachers to improve test scores, and instruction narrows around the test. A platform tells a recommender system to maximize engagement, and the system learns that outrage keeps people watching. A company tells managers to reduce costs, and important forms of care disappear because they were not measured. A college tells an AI advising system to maximize completion speed, and the system may push students toward efficient degree paths even when exploration, confidence, work schedule, caregiving responsibilities, or transfer goals matter more.

<!-- phil-passage-id: ch16-p0112 -->
These are not existential-risk cases, but they reveal the structure. Optimization follows the target it is given, and the target is almost always thinner than the human good that motivated it.

<!-- phil-passage-id: ch16-p0113 -->
For PHIL 123 students, the alignment question is not only "Will superintelligence kill us?" It is also:

<!-- phil-passage-id: ch16-p0114 -->
- What is this system being optimized to do?
- What human value is the metric supposed to represent?
- What does the metric leave out?
- Who chose the metric?
- Who can challenge the metric?
- What happens when the system gets better at achieving the metric?
- What would count as evidence that the system is satisfying the proxy while betraying the purpose?

<!-- phil-passage-id: ch16-p0115 -->
**Key Point: The Paperclip Maximizer Is About Misaligned Optimization.** The paperclip case is not a prediction about office supplies. It is a test case for the gap between capability and value. A harmless-sounding objective can become dangerous when a capable system pursues it without preserving the human values that objective was supposed to serve.

<!-- phil-section-id: ch16-s014 -->
## AI Alignment Is Also A Political Problem

<!-- phil-passage-id: ch16-p0116 -->
Alignment language can hide disagreement. If someone says "we need aligned AI," the next question is: aligned with whose values?

<!-- phil-passage-id: ch16-p0117 -->
A model aligned to user satisfaction may flatter, indulge, or manipulate. A model aligned to corporate policy may serve institutional risk management more than public good. A model aligned to a narrow educational metric may harm the students the metric was supposed to help. A model aligned to "human values" has to face the fact that human beings disagree about values.

<!-- phil-passage-id: ch16-p0118 -->
This is why alignment is not only technical. It is also ethical and political. Technical alignment asks whether the system reliably follows the intended objective. Normative alignment asks whether the intended objective is worth following. Institutional alignment asks whether the process for defining and enforcing the objective is legitimate.

<!-- phil-passage-id: ch16-p0119 -->
A college AI advising system may be technically aligned if it reliably recommends schedules that maximize timely completion. It may be normatively misaligned if timely completion is treated as more important than student agency, exploration, transfer planning, or personal circumstances. It may be institutionally misaligned if students cannot know when AI shaped their recommendation, cannot appeal the recommendation, and cannot reach a human advisor.

<!-- phil-passage-id: ch16-p0120 -->
A frontier AI lab may be technically serious about alignment research while still leaving the public with limited authority over deployment. Its safety team may investigate real risks. Its company incentives may still favor speed, market share, investor returns, and reputational control. Both can be true.

<!-- phil-passage-id: ch16-p0121 -->
A philosophical design review therefore asks four alignment questions:

<!-- phil-passage-id: ch16-p0122 -->
1. **Technical:** Does the system reliably pursue the specified objective?
2. **Normative:** Is that objective a good representation of the human good at stake?
3. **Participatory:** Were affected people included in defining the objective and acceptable tradeoffs?
4. **Governance:** Who can audit, appeal, pause, or override the system?

<!-- phil-passage-id: ch16-p0123 -->
This four-part version of alignment is often more useful for students than the slogan "make AI do what we want."

<!-- phil-section-id: ch16-s015 -->
## Contemporary AI Risk Discourse: Why The Debate Is Live

<!-- phil-passage-id: ch16-p0124 -->
Existential-risk language now comes from inside the frontier-AI world as well as from watchdogs, philosophers, journalists, and activists. That does not prove the risk estimates are correct. It does mean the topic is part of live AI governance.

<!-- phil-passage-id: ch16-p0125 -->
The [2023 Center for AI Safety statement](https://safe.ai/work/statement-on-ai-extinction-risk) says that mitigating extinction risk from AI should be treated as a global priority alongside pandemics and nuclear war. Its visible signatories include major AI scientists and public figures such as Geoffrey Hinton, Yoshua Bengio, Demis Hassabis, Sam Altman, Dario Amodei, Daniela Amodei, Ilya Sutskever, Stuart Russell, and others. The statement is important less because it settles the issue and more because it shows that some influential AI figures publicly treat extinction risk as a serious concern.

<!-- phil-passage-id: ch16-p0126 -->
The Future of Life Institute's [2017 Asilomar AI Principles](https://futureoflife.org/open-letter/ai-principles/) include principles on safety, failure transparency, human control, value alignment, shared benefit, and planning for catastrophic or existential risks proportional to expected impact. Its 2025 [Statement on Superintelligence](https://superintelligence-statement.org/) calls for prohibiting development of superintelligence until there is broad scientific consensus that it can be done safely and controllably, along with strong public buy-in. Those statements turn the control problem into a governance problem: who should decide whether a system may be built, and under what evidence conditions?

<!-- phil-passage-id: ch16-p0127 -->
In late 2024, Geoffrey Hinton said in a BBC Radio 4 interview, as reported by *The Guardian*, that he had raised his estimate of the chance that AI could lead to human extinction within the next thirty years. *The Guardian* reported the number as 10 to 20 percent. That figure should be treated as a public estimate from one prominent researcher, not as a scientific consensus. It matters because it is a clear example of an expert forecast entering public ethical debate.

<!-- phil-passage-id: ch16-p0128 -->
Other contemporary sources work differently. The [AI 2027](https://ai-2027.com/) project presents a detailed scenario for how advanced AI might develop over the next few years. The authors describe the scenario as their best guess and explicitly say it is not a recommendation or exhortation. Epoch AI's ["What will AI look like in 2030?"](https://epoch.ai/publications/what-will-ai-look-like-in-2030) focuses on compute, investment, infrastructure, energy, data, hardware, automation, and scientific R&D. The report notes that it was commissioned by Google DeepMind while stating that its conclusions are the authors' and not necessarily DeepMind's position. The UK Government Office for Science has published [AI Scenarios 2030](https://www.gov.uk/government/publications/ai-scenarios-2030-helping-policymakers-plan-for-the-future-of-ai/ai-scenarios-2030-helping-policymakers-plan-for-the-future-of-ai) as a planning resource and explicitly states that it is not a statement of policy. The OECD's [*Exploring possible AI trajectories through 2030*](https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/02/exploring-possible-ai-trajectories-through-2030_b6fb75d9/cb41117a-en.pdf) frames its trajectories as plausible but uncertain scenarios for policy discussion, not predictions with assigned probabilities.

<!-- phil-passage-id: ch16-p0129 -->
This range of documents is pedagogically useful because it shows students the difference between forecast, scenario, and threshold. Hinton's number is a forecast-like public estimate. AI 2027 is a concrete scenario. The UK and OECD reports use scenarios for planning under uncertainty. Company safety frameworks use thresholds to govern model development and release.

<!-- phil-passage-id: ch16-p0130 -->
The chapter's critical point remains: exact prediction is fragile, but planning under uncertainty is still necessary. We do this in ordinary life. You decide whether to save money, which degree path to follow, whether to trust a workplace tool, whether a new technology will matter in your field, whether a health symptom is serious enough to call a doctor, whether a source is strong enough to use in an assignment. None of those decisions begins from certainty. You act under uncertainty all the time. The scale changes when the forecast concerns advanced AI, large institutions, global risks, or people who may not yet exist.

<!-- phil-section-id: ch16-s016 -->
## Forecasts Become Company Frameworks

<!-- phil-passage-id: ch16-p0131 -->
Future-stakes reasoning becomes more concrete when it enters institutional procedure. Companies can use forecasts and risk models to create release conditions, safety cases, risk reports, review processes, and pause points.

<!-- phil-passage-id: ch16-p0132 -->
OpenAI's [Charter](https://openai.com/charter/) frames the organization's mission around ensuring that artificial general intelligence benefits all of humanity. It also says OpenAI is concerned about late-stage AGI development becoming a competitive race without adequate safety precautions. OpenAI's [Preparedness Framework v2](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf), last updated April 15, 2025, identifies tracked categories such as biological and chemical capabilities, cybersecurity capabilities, and AI self-improvement capabilities. It uses threat models, measurable thresholds, safeguards, internal governance, and external participation to manage severe risks.

<!-- phil-passage-id: ch16-p0133 -->
Anthropic's [Responsible Scaling Policy](https://www.anthropic.com/responsible-scaling-policy) is a live policy document. The page lists version 3.3 as effective May 26, 2026. The policy page describes the RSP as proportional, iterative, and exportable; it links capability thresholds to safeguards, frontier safety roadmaps, risk reports, and related governance processes. Anthropic's [Long-Term Benefit Trust](https://www.anthropic.com/news/the-long-term-benefit-trust) is a corporate-governance mechanism explicitly oriented toward long-term public benefit.

<!-- phil-passage-id: ch16-p0134 -->
Google DeepMind's [Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) is another example. The April 2026 update describes a third iteration of the framework, including risk domains, critical capability levels, tracked capability levels, safety case reviews, risk assessment, harmful manipulation concerns, misalignment risks, and evidence-based mitigation.

<!-- phil-passage-id: ch16-p0135 -->
These documents differ in structure, authority, and quality. They do not prove that any company is safe. Their importance in this chapter is that they show future-stakes reasoning becoming operational. Concerns about existential risk, misuse, alignment, and benefit to humanity become capability thresholds, model evaluations, safety cases, board structures, release rules, and public commitments.

<!-- phil-passage-id: ch16-p0136 -->
This translation changes the ethical question. A philosophical argument can say, "Some risks are severe enough to justify special caution." A framework has to say which risks, what evidence counts, who evaluates the evidence, what capability level triggers safeguards, and what the organization promises to do if the threshold is crossed.

<!-- phil-passage-id: ch16-p0137 -->
A serious framework needs answers to at least six questions:

<!-- phil-passage-id: ch16-p0138 -->
1. **Risk definition:** What harms count as severe enough to trigger the framework?
2. **Measurement:** What evaluations or evidence track those harms?
3. **Threshold:** What finding changes what the organization is allowed to do?
4. **Safeguard:** What mitigation is required before internal use, deployment, or further development?
5. **Authority:** Who interprets the evidence and who can overrule whom?
6. **Accountability:** What can outsiders inspect, challenge, or enforce?

<!-- phil-passage-id: ch16-p0139 -->
A weak framework leaves the word "safety" in place while keeping decisive judgment inside the institution. A stronger framework creates decision points that can actually constrain the institution when it has incentives to keep moving.

<!-- phil-passage-id: ch16-p0140 -->
Company frameworks should not be read as either empty public relations or sufficient governance. Both reactions are too simple. A preparedness framework can be better than nothing and still inadequate. A safety case can force useful evidence and still be judged by conflicted actors. A long-term-benefit structure can alter corporate governance and still leave the public with limited authority.

<!-- phil-passage-id: ch16-p0141 -->
<aside class="textbox shaded" role="note" aria-labelledby="caution-safety-language">
<h3 id="caution-safety-language">Caution: Safety Language Can Constrain Power Or Concentrate It</h3>
<p>A responsible-scaling policy may create real safeguards. It may also give private labs more authority to define the problem, set the threshold, and decide when their own systems are ready. The ethical question is what the framework requires, what it leaves voluntary, and who can challenge it.</p>
</aside>

<!-- phil-passage-id: ch16-p0142 -->
For PHIL 123 students, these company documents are examples of values embedded in procedure. A safety framework is not just technical paperwork. It tells us what an organization thinks counts as severe harm, how it treats uncertainty, what evidence it trusts, who has authority, and what it is willing to delay or refuse.

<!-- phil-section-id: ch16-s017 -->
## Cultural Prehistory: Why AI Risk Sounds Apocalyptic

<!-- phil-passage-id: ch16-p0143 -->
Now we can return to the older cultural material without confusing it with the direct genealogy of Effective Altruism.

<!-- phil-passage-id: ch16-p0144 -->
Fear of world-ending technology did not begin with AI. Long before frontier model evaluations, safety cases, or AI-extinction estimates, Western culture had languages for the end of history. In Jewish and Christian apocalyptic traditions, the end was usually not a human invention. It was divine judgment, cosmic conflict, catastrophe, and renewal. The Book of Revelation became the most famous Christian example, but the broader pattern is older: history moves toward unveiling, crisis, judgment, and transformation. Human beings may be judged, rescued, punished, or purified. They are not usually the engineers of the final event.

<!-- phil-passage-id: ch16-p0145 -->
Modernity changes that picture. As political economy, science, and technology become central ways of understanding the world, apocalypse becomes increasingly secular. The end of the world can be imagined not only as God's judgment but as the consequence of human action, human growth, human production, human machines, or human failure to govern systems we set in motion.

<!-- phil-passage-id: ch16-p0146 -->
Thomas Malthus's 1798 [*Essay on the Principle of Population*](https://www.gutenberg.org/ebooks/4239) is one early hinge. Malthus argued that population could grow faster than food supply, creating pressure toward famine, poverty, and disease. Whether one accepts Malthus's theory is not the point here. The shift matters because catastrophe becomes systemic. Doom no longer has to arrive as a divine decree. It can arise from the ordinary arithmetic of human life.

<!-- phil-passage-id: ch16-p0147 -->
Mary Shelley's [*Frankenstein*](https://www.gutenberg.org/ebooks/84) gives the same shift a more intimate form. Victor Frankenstein does not destroy the world with a bomb. He creates life and then refuses responsibility for what he created. The creature is not evil by design; it becomes dangerous inside a failed relationship between maker, made being, and society. That story matters for AI ethics because it keeps returning to one question: what do creators owe to powerful things they bring into the world? If the creation exceeds the creator's control, the moral failure begins before the disaster.

<!-- phil-passage-id: ch16-p0148 -->
The twentieth century made self-authored catastrophe concrete. Nuclear weapons showed that human beings could build technologies with civilization-ending potential. The [Doomsday Clock](https://thebulletin.org/doomsday-clock/) was created in 1947 by the Bulletin of the Atomic Scientists as a public symbol of how close humanity might be to catastrophe, initially under the shadow of nuclear war. Its power came from a new condition: species-level danger belonged not only to myth, scripture, or fiction but to policy, laboratories, military systems, diplomacy, and public judgment.

<!-- phil-passage-id: ch16-p0149 -->
After nuclear weapons, catastrophic-risk thinking widened. Environmental collapse, engineered pandemics, cyber conflict, biotechnology, and global interdependence all made the same lesson harder to ignore. Modern societies create systems they cannot fully see, and some of those systems can fail at enormous scale. AI inherits that background but adds a distinctive possibility: a system that can reason, plan, persuade, code, copy, use tools, improve workflows, discover vulnerabilities, automate research, or act through institutions at a scale humans may not fully monitor.

<!-- phil-passage-id: ch16-p0150 -->
This cultural prehistory does not prove that AI existential-risk arguments are true. It explains why they resonate. AI risk discourse belongs to a longer Western pattern: first, the end as divine judgment; then secular catastrophe as system failure; then nuclear self-destruction as a real political possibility; now advanced AI as a possible loss-of-control problem.

<!-- phil-passage-id: ch16-p0151 -->
The cultural pattern can also mislead. If AI risk feels apocalyptic, people may become more dramatic than precise. They may mistake mythic resonance for evidence. They may treat skepticism as moral blindness. Or they may dismiss the issue merely because it sounds apocalyptic. Both reactions are weak. The ethical question is not whether AI risk resembles older end-times stories. The ethical question is whether the mechanisms, evidence, safeguards, and authority claims are credible.

<!-- phil-section-id: ch16-s018 -->
## Critiques: What The Future-Stakes Lens Can Distort

<!-- phil-passage-id: ch16-p0152 -->
The future-stakes lens reveals something important: a system can be locally useful and globally dangerous. A feature can help today's users and still create future dependency, vulnerability, or concentration of power. A tool can produce benefits in one field while building risks that only appear when it scales. A safety question can matter before harm has happened.

<!-- phil-passage-id: ch16-p0153 -->
The same lens can distort judgment.

<!-- phil-passage-id: ch16-p0154 -->
One distortion is **present-harm displacement**. If speculative future harms are described as enormous, current harms may look morally small by comparison. Labor exploitation, data extraction, bias, environmental costs, surveillance, educational disruption, mental-health effects, creative appropriation, and concentration of wealth may be treated as distractions from the "real" problem. That is ethically dangerous because present people are not morally expendable.

<!-- phil-passage-id: ch16-p0155 -->
Timnit Gebru and Émile Torres's [TESCREAL critique](https://firstmonday.org/ojs/index.php/fm/article/view/13636) argues that some AGI and longtermist discourse is bound up with utopian, eugenic, and power-concentrating frameworks. Their article is a critique, not a neutral taxonomy, and students should read it as a contested intervention. But the underlying question is important: who gets to define "humanity's future," and whose harms are ignored when the future is framed in abstract, totalizing terms?

<!-- phil-passage-id: ch16-p0156 -->
Medical-ethics critiques such as ["AI and the falling sky: interrogating X-Risk"](https://doi.org/10.1136/jme-2023-109702) press a related concern: dramatic existential-risk language can draw attention away from present and near-term AI harms that already require governance. Shannon Vallor's [*The AI Mirror*](https://global.oup.com/academic/product/the-ai-mirror-9780197759066) similarly criticizes AI discourse that projects human hopes, fears, and power fantasies into machines while neglecting the human practices and institutions that need repair.

<!-- phil-passage-id: ch16-p0157 -->
A second distortion is **elite substitution**. If future-stakes reasoning says that a small group of experts, donors, researchers, or labs can see the largest risks before the public can, then those groups may claim special authority to set priorities. They may decide which risks count, which interventions deserve money, which companies need freedom, which regulations are helpful, which harms are distractions, and which futures deserve protection.

<!-- phil-passage-id: ch16-p0158 -->
Theodore Lechterman's ["The Effective Altruist's Political Problem"](https://www.journals.uchicago.edu/doi/abs/10.1086/706867) helps frame this objection. Methods suited to individual charity or technical cause prioritization do not automatically transfer to political reform. Political decisions involve legitimacy, equality, representation, coercion, and public authority. A donor choosing where to give money is not the same as a public deciding how it should be governed.

<!-- phil-passage-id: ch16-p0159 -->
Apply that objection to AI safety. A frontier lab may claim that it must build more powerful systems in order to understand and control future risk. A company may say its safety framework is adequate while keeping key evidence private. A donor network may fund AI safety because it believes existential risk dominates. Regulation shaped around frontier safety may protect the public, but it may also create a compliance moat only large labs can cross. Each case turns on authority: who evaluates the claim, who sees the evidence, who decides the priority, and who benefits from the rule?

<!-- phil-passage-id: ch16-p0160 -->
A third distortion is **corporate moral laundering**. A company may genuinely worry about catastrophic risk while also benefiting from being seen as the responsible actor in the room. It may favor rules it can afford, prefer voluntary frameworks over binding regulation, and publish safety documents that help recruit talent, reassure investors, and influence policy. Ethics has to analyze those incentives even when no one is acting in bad faith.

<!-- phil-passage-id: ch16-p0161 -->
A fourth distortion is **single-axis moral reasoning**. If the future is described mainly in terms of total expected value, other values can disappear: rights, dignity, consent, democratic legitimacy, justice, repair, solidarity, community, and human development. A design can be efficient and still disrespectful. A safety policy can reduce one risk and increase another. A forecast can be sincere and still politically illegitimate as a basis for unilateral action.

<!-- phil-passage-id: ch16-p0162 -->
The strongest critique of future-stakes reasoning can be stated this way:

<!-- phil-passage-id: ch16-p0163 -->
1. Future-stakes arguments often rely on expertise, technical forecasting, and moral calculations ordinary citizens cannot easily inspect.
2. The institutions acting on those arguments may be private labs, donor networks, or expert communities without democratic accountability.
3. Those institutions may benefit from the safety language they use.
4. Therefore, even a morally serious future-stakes argument can become politically dangerous when it concentrates authority over everyone else's future.

<!-- phil-passage-id: ch16-p0164 -->
That objection has force. It does not imply that catastrophic risks are imaginary. Expertise is not optional. If a system could create catastrophic cyber, biological, autonomous replication, manipulation, or loss-of-control risks, public judgment still needs technical knowledge. Democratic legitimacy cannot mean that every citizen personally audits model weights or reads every red-team report.

<!-- phil-passage-id: ch16-p0165 -->
The better reply is **contestability**.

<!-- phil-section-id: ch16-s019 -->
## Contestability: Acting Under Uncertainty Without A Blank Check

<!-- phil-passage-id: ch16-p0166 -->
Contestability asks whether affected people or legitimate representatives have a realistic way to question evidence, appeal decisions, expose incentives, demand reasons, or trigger review. It does not require every person to become a technical expert. It requires power to be answerable.

<!-- phil-passage-id: ch16-p0167 -->
In a classroom, contestability might mean that a student can challenge an AI-generated academic-integrity accusation. In health care, it might mean that a clinician can override a model and a patient can understand why an AI-supported recommendation was made. In hiring, it might mean that applicants know when automated screening was used and can request human review. In public benefits, it might mean transparent criteria, appeal rights, and independent audit. In frontier AI governance, it might mean external evaluations, public reporting, incident disclosure, whistleblower protection, regulatory authority, and safety cases reviewed by actors who are not financially dependent on the company.

<!-- phil-passage-id: ch16-p0168 -->
Contestability does not solve every problem. Some information cannot be fully public without creating security risks. Some evaluations require expertise. Some decisions must be made under time pressure. But contestability gives a better question than "Do we trust this institution?" Trust is too blunt. Ask what the institution discloses, what it refuses to disclose, who audits it, who can stop it, who pays if the decision is wrong, and whether the people most affected have any route to challenge the outcome.

<!-- phil-passage-id: ch16-p0169 -->
For students, contestability is one of the most important concepts in the chapter. It turns a broad claim about responsibility into questions that can be asked of a documented case. A system is more ethically responsible when it includes:

<!-- phil-passage-id: ch16-p0170 -->
- Notice that AI is being used.
- Reasons or explanations appropriate to the context.
- A way to appeal or request human review.
- Independent evaluation where stakes are high.
- Documentation of known limitations.
- Incident reporting and correction procedures.
- Clear responsibility for harms.
- A pause or shutdown condition.
- A way for affected communities to shape the system's use.

<!-- phil-passage-id: ch16-p0171 -->
Contestability also protects future-stakes reasoning from becoming authoritarian. Future people cannot vote today. Someone has to represent their interests. But anyone claiming to represent them should face stronger, not weaker, accountability. The more a group claims to act for humanity's future, the more clearly it should show who is affected now, who benefits from the decision, who can challenge it, and what the group is willing not to do.

<!-- phil-passage-id: ch16-p0172 -->
This gives us the chapter's most defensible middle position: **constrained future-stakes responsibility**. Future people and catastrophic risks matter. Severe irreversible harm can justify safeguards, staged deployment, refusal conditions, and major research effort. But uncertainty and scale do not erase democratic legitimacy. They do not make present people morally expendable. They do not give labs automatic authority to govern the future in the public's name.

<!-- phil-section-id: ch16-s020 -->
## Using The Future-Stakes Lens On A Case

<!-- phil-passage-id: ch16-p0173 -->
In PHIL 123, the future-stakes lens is used to test a considered judgment, not to add futuristic vocabulary to a case. It asks students to make assumptions visible, widen the field of concern, and decide whether scale, reversibility, or contestability should change a position they could otherwise defend.

<!-- phil-passage-id: ch16-p0174 -->
Future-stakes reasoning changes a case analysis in four ways.

<!-- phil-passage-id: ch16-p0175 -->
First, it widens the stakeholder map. Singer asks us not to ignore people because they are distant. Parfit asks us not to ignore people because they are future or possible. AI ethics asks us not to ignore people because they are not the buyer, not the user, not the data scientist, not the investor, or not yet alive.

<!-- phil-passage-id: ch16-p0176 -->
Second, it shifts attention from isolated use to scaled practice. A tool may be harmless in one classroom and harmful when required across a district. A decision aid may be helpful for one clinician and dangerous when it becomes a liability shield for a hospital. A coding agent may help one programmer and create field-level dependence when entire teams stop understanding their own codebases.

<!-- phil-passage-id: ch16-p0177 -->
Third, it treats reversibility as a moral feature. A system is less risky when it can be paused, audited, rolled back, repaired, exited, or used only in limited settings. It is more risky when institutions build around it so deeply that later refusal becomes unrealistic.

<!-- phil-passage-id: ch16-p0178 -->
Fourth, it requires thresholds. A responsible judgment should identify what finding would justify pause, redesign, refusal, or escalation. Without thresholds, "safety" can mean little more than continued observation during continued deployment.

<!-- phil-passage-id: ch16-p0179 -->
A future-stakes case review can use this sequence:

<!-- phil-passage-id: ch16-p0180 -->
1. **Name the local benefit.** What problem is the AI system supposed to solve?
2. **Identify the proxy.** What measurable target stands in for the human good?
3. **Ask who is absent.** Who is affected but weakly represented in the evidence or decision?
4. **Scale the system.** What happens if this becomes normal across a field?
5. **Identify future dependencies.** What skills, institutions, habits, or vulnerabilities might the design create?
6. **Check reversibility.** Can the system be paused, corrected, appealed, or exited?
7. **Check contestability.** Can affected people challenge the output, evidence, or process?
8. **State the threshold.** What finding would justify stopping, delaying, redesigning, or refusing deployment?

<!-- phil-passage-id: ch16-p0181 -->
This sequence lets future-stakes reasoning pressure a considered judgment without turning every decision into an abstract calculation. It uses impartiality, effectiveness, future stakeholders, existential-risk caution, alignment, and contestability as questions that may support, limit, or revise a position.

<!-- phil-section-id: ch16-s021 -->
## Worked Example: An AI Academic Advising Tool

<!-- phil-passage-id: ch16-p0182 -->
Imagine a community college considering an AI advising tool. The tool recommends courses, alerts students when they are off track, predicts completion risk, and suggests degree pathways. The vendor says the tool will reduce advisor workload and improve retention.

<!-- phil-passage-id: ch16-p0183 -->
A shallow ethics review might ask only whether the tool is accurate and whether the contract complies with privacy rules. A philosophical review asks more.

<!-- phil-passage-id: ch16-p0184 -->
**Local benefit:** The tool may help students choose courses quickly, reduce confusion, flag problems earlier, and free advisors from routine scheduling questions. Those are real benefits. A college should not romanticize inefficient systems that leave students waiting weeks for help.

<!-- phil-passage-id: ch16-p0185 -->
**Singer-style question:** Whose interests are distant from the decision makers? First-generation students, multilingual students, students on probation, students changing majors, students with disabilities, students with unstable work schedules, students with caregiving responsibilities, students who distrust institutions, adjunct advisors, and future students may all be affected. If the tool is designed mainly for administrators and average-case users, it may ignore the students who need advising most.

<!-- phil-passage-id: ch16-p0186 -->
**Effectiveness question:** Does the tool actually improve student flourishing compared with alternatives? The comparison should not be "AI advising versus nothing." It should include additional advisors, better program maps, simpler registration systems, proactive human outreach, emergency grants, embedded tutoring, and course scheduling reforms.

<!-- phil-passage-id: ch16-p0187 -->
**Proxy question:** What is the system optimizing? Faster completion? Retention? Credit efficiency? Seat availability? Lower advising cost? These can matter. But student flourishing may also include confidence, exploration, transfer goals, career fit, belonging, agency, and the ability to recover from mistakes.

<!-- phil-passage-id: ch16-p0188 -->
**Parfit-style future question:** What advising culture will future students inherit if the institution normalizes automated degree-path recommendations? Future students may not be able to say a single decision harmed them. They may simply inherit a college where degree choice has become more automated, less relational, and more shaped by vendor analytics.

<!-- phil-passage-id: ch16-p0189 -->
**Alignment question:** Is the system aligned with student goals or institutional goals? If the student wants to explore philosophy before choosing nursing, but the institution wants fastest completion, whose goal does the model serve? If a recommendation is good for retention metrics but bad for the student's long-term agency, is the system aligned?

<!-- phil-passage-id: ch16-p0190 -->
**Longtermist scaled-down question:** This is not existential risk. But it may create hard-to-reverse dependency if advising knowledge moves from human staff into vendor infrastructure. If future advisors no longer understand how recommendations are generated, the institution loses capacity.

<!-- phil-passage-id: ch16-p0191 -->
**Contestability question:** Can students challenge recommendations? Do they know when AI influenced advice? Can they reach a human advisor? Can advisors override the system? Are subgroup error rates audited? Are students told what data the system uses? Is there an appeal process when a recommendation blocks a path?

<!-- phil-passage-id: ch16-p0192 -->
**Reversibility question:** Can the college pause the system if audits show harm? Can data be exported? Can the college leave the vendor? Are human advising skills maintained? Is there a non-AI fallback?

<!-- phil-passage-id: ch16-p0193 -->
**Threshold:** The college should not scale the system if subgroup audits show systematic misdirection, if students cannot appeal, if human advisors cannot override recommendations, if the vendor cannot explain key factors, if data practices are unacceptable, or if the tool's benefits disappear when compared with simpler reforms.

<!-- phil-passage-id: ch16-p0194 -->
This example shows how the chapter's genealogy becomes practical. Singer widens the stakeholder map. Effectiveness asks whether the intervention works. Parfit asks what future students inherit. Bostrom's existential-risk category does not directly apply, but the concepts of irreversible loss and lock-in do. Alignment asks whether the proxy preserves the human good. Contestability asks who can challenge the system.

<!-- phil-section-id: ch16-s022 -->
## Applying The Lens Across Student Case Inquiries

<!-- phil-passage-id: ch16-p0195 -->
The same pattern works across PHIL 123 case inquiries.

<!-- phil-passage-id: ch16-p0196 -->
A student studying **AI in nursing** might begin with documentation efficiency or triage support. Future-stakes reasoning asks what happens when the system scales across hospitals, insurers, regulators, and vendors. Does it reduce nurse burnout or increase monitoring? Does it help clinicians notice rare conditions or make them defer to a model? What happens to nursing judgment if documentation becomes model-mediated?

<!-- phil-passage-id: ch16-p0197 -->
A student studying **AI in criminal justice** might begin with predictive accuracy. Future-stakes reasoning asks what institutional dependency, surveillance network, appeal process, or authority structure the tool creates. Does the system make policing more accountable or more opaque? Who can challenge a risk score? What happens if the model's categories shape future enforcement patterns?

<!-- phil-passage-id: ch16-p0198 -->
A student studying **AI companions** might begin with loneliness and emotional support. Future-stakes reasoning asks what happens when millions of people learn to relate to systems designed by private companies and tuned for engagement, retention, compliance, or subscription. Does the design increase human connection or replace it with managed attachment?

<!-- phil-passage-id: ch16-p0199 -->
A student studying **AI in agriculture** might ask whether farms become dependent on a vendor's predictive system for irrigation, pest management, seed selection, or market timing. Does the system improve sustainability or concentrate power over food systems? What happens to farmer knowledge if decisions move into proprietary models?

<!-- phil-passage-id: ch16-p0200 -->
A student studying **AI in creative fields** might ask whether AI-generated content changes what counts as originality, what skills entry-level workers can develop, and whether markets become flooded with cheap imitation. Does the system democratize creativity or devalue the labor and training that make creative communities possible?

<!-- phil-passage-id: ch16-p0201 -->
A student studying **AI coding agents** might ask whether they accelerate useful work while hiding technical debt that later teams cannot understand. What happens if codebases become larger, more complex, and less human-comprehensible? What threshold would require human review?

<!-- phil-passage-id: ch16-p0202 -->
A student studying **AI in education** might ask whether tutoring tools help students practice or make it easier to bypass the struggle that builds judgment. Does the system create learning, or only answer production? How would an instructor know?

<!-- phil-passage-id: ch16-p0203 -->
These examples avoid two mistakes. One mistake is shrinking the lens until it only applies to world-ending risks. Then almost every ordinary case looks too small. The other mistake is inflating every concern until it sounds existential. Then the language becomes theatrical and loses credibility. A better use of the lens is to ask what future condition the technology is helping produce: more agency or less, more contestability or less, more skill or less, more dependency or less, more public accountability or less.

<!-- phil-section-id: ch16-s023 -->
## Future-Stakes Judgment Audit

<!-- phil-passage-id: ch16-p0204 -->
A future-stakes audit is a compact way to use this chapter without pretending to solve the future.

<!-- phil-passage-id: ch16-p0205 -->
Start with the technology or practice you are studying. Do not begin with apocalypse. Begin with scale. What happens if this tool works well enough to become normal in a field? What happens if a company, school, hospital, court, agency, employer, platform, or family system begins depending on it?

<!-- phil-passage-id: ch16-p0206 -->
Then answer eight questions.

<!-- phil-section-id: ch16-s024 -->
### 1. What is the local benefit?

<!-- phil-passage-id: ch16-p0207 -->
Name the real good the system promises. Faster service? Better access? Lower cost? More accurate diagnosis? Personalized learning? Reduced paperwork? Creative support? Do not dismiss the benefit just because the system is risky. Ethical analysis starts by seeing the good clearly.

<!-- phil-section-id: ch16-s025 -->
### 2. What is the proxy?

<!-- phil-passage-id: ch16-p0208 -->
What measurable target stands in for the human good? Retention, clicks, completion, accuracy, engagement, cost reduction, risk score, time saved, customer satisfaction, or productivity? What does that proxy leave out?

<!-- phil-section-id: ch16-s026 -->
### 3. Who is absent from the design room?

<!-- phil-passage-id: ch16-p0209 -->
Include current users, workers, non-users, data subjects, families, institutions, future users, and communities affected downstream. Ask especially about people who are distant, low-power, hard to measure, or unlikely to be represented by the buyer.

<!-- phil-section-id: ch16-s027 -->
### 4. What happens if the system scales?

<!-- phil-passage-id: ch16-p0210 -->
What changes when the tool becomes normal across a school, profession, platform, industry, or government system? Scale can change the moral category. A tool that is optional for one expert may become coercive when institutions require it.

<!-- phil-section-id: ch16-s028 -->
### 5. What future dependency might it create?

<!-- phil-passage-id: ch16-p0211 -->
Could the design produce skill loss, vendor lock-in, data dependence, institutional opacity, weakened professional judgment, concentrated power, environmental costs, or reduced public accountability? Which dependencies are reversible and which are not?

<!-- phil-section-id: ch16-s029 -->
### 6. What forecast or assumption carries the argument?

<!-- phil-passage-id: ch16-p0212 -->
Maybe the assumption is that model capabilities will keep improving. Maybe costs will drop. Maybe people will trust the tool because it saves time. Maybe a company will maintain safeguards even when competition increases. Maybe students will use the tool to learn rather than bypass learning. Make the assumption visible.

<!-- phil-section-id: ch16-s030 -->
### 7. What safeguard is proportional?

<!-- phil-passage-id: ch16-p0213 -->
The answer might be human review, appeal rights, staged rollout, independent audit, incident reporting, refusal to automate one decision, data minimization, skill-retention training, red-team testing, environmental accounting, transparency reports, or a shutdown threshold.

<!-- phil-section-id: ch16-s031 -->
### 8. Who decides, who can contest, and who absorbs the risk?

<!-- phil-passage-id: ch16-p0214 -->
A decision made for users without users, patients without patients, students without students, workers without workers, or future people without public accountability is ethically weak even if the intention is good. Ask who has authority and who has recourse.

<!-- phil-passage-id: ch16-p0215 -->
<aside class="textbox exercises" aria-labelledby="try-it-one-sentence-audit">
<h3 id="try-it-one-sentence-audit">Try It: One-Sentence Audit</h3>
<p>For your anchor case, write one sentence for each category: local benefit, proxy, absent stakeholders, scale effect, future dependency, key assumption, proportional safeguard, and contestability. Then state whether the lens strengthens, challenges, or qualifies your provisional view. Keep each sentence concrete enough that someone else could check your reasoning.</p>
</aside>

<!-- phil-section-id: ch16-s032 -->
## Common Mistakes To Avoid

<!-- phil-passage-id: ch16-p0216 -->
**Mistake 1: Treating every future concern as existential risk.** Most AI ethics topics are not extinction risks. They can still involve future stakeholders, lock-in, dependency, and hard-to-repair institutional change.

<!-- phil-passage-id: ch16-p0217 -->
**Mistake 2: Treating present harms as morally small because future harms might be larger.** Present people are not expendable. A serious future-stakes argument must explain why its safeguards or priorities are proportional and legitimate.

<!-- phil-passage-id: ch16-p0218 -->
**Mistake 3: Letting huge numbers replace mechanisms.** Large possible stakes matter only if there is a credible path from action to outcome. Ask how the intervention actually reduces risk or improves the future.

<!-- phil-passage-id: ch16-p0219 -->
**Mistake 4: Confusing a scenario with a prediction.** A scenario can be useful without being likely. Do not cite a scenario as if it were a consensus forecast.

<!-- phil-passage-id: ch16-p0220 -->
**Mistake 5: Confusing a company safety framework with public accountability.** A framework may create real constraints, but it still matters who designs it, who reviews it, what is public, and who can enforce it.

<!-- phil-passage-id: ch16-p0221 -->
**Mistake 6: Treating alignment as purely technical.** Alignment also asks whose values, which process, what oversight, and what right to contest.

<!-- phil-passage-id: ch16-p0222 -->
**Mistake 7: Treating effectiveness as metric maximization.** Evidence matters. So do rights, agency, relationships, trust, dignity, and justice.

<!-- phil-section-id: ch16-s033 -->
## The Chapter's Core Arguments In One Place

<!-- phil-section-id: ch16-s034 -->
### Singer's argument

<!-- phil-passage-id: ch16-p0223 -->
If you can prevent serious suffering or death without sacrificing anything morally comparable, you have strong moral reason to do so. Distance alone does not erase that reason. In design, this means you should look for affected people who are invisible because they are distant from the buyer, designer, or user.

<!-- phil-section-id: ch16-s035 -->
### The effectiveness argument

<!-- phil-passage-id: ch16-p0224 -->
Good intentions are not enough. If the goal is to help, then outcomes and alternatives matter. In design, this means comparing the AI system with other interventions rather than assuming innovation equals benefit.

<!-- phil-section-id: ch16-s036 -->
### Parfit's argument

<!-- phil-passage-id: ch16-p0225 -->
Future people matter, but future-person ethics does not fit ordinary harm reasoning cleanly. Some choices shape which people exist and what world they inherit. In design, this means looking at trajectories, dependencies, and institutions, not only immediate individual harms.

<!-- phil-section-id: ch16-s037 -->
### Bostrom's argument

<!-- phil-passage-id: ch16-p0226 -->
Some risks are morally distinctive because they could permanently destroy or drastically curtail humanity's future. In design, this means giving special attention to irreversible loss, loss of control, and hard-to-repair scaling effects.

<!-- phil-section-id: ch16-s038 -->
### The longtermist argument

<!-- phil-passage-id: ch16-p0227 -->
Because the future may contain enormous value, actions that improve the long-term future may deserve unusually high priority. In design, this means asking whether today's systems make future agency, flourishing, and governance better or worse. The argument requires evidence, tractability, and safeguards against speculative overreach.

<!-- phil-section-id: ch16-s039 -->
### The alignment argument

<!-- phil-passage-id: ch16-p0228 -->
Capability does not guarantee human-compatible values. Systems can optimize proxies in ways that defeat the purpose behind the metric. In design, this means asking what the system is really optimizing, who defines the target, and how people can challenge the result.

<!-- phil-section-id: ch16-s040 -->
### The legitimacy argument

<!-- phil-passage-id: ch16-p0229 -->
Future people cannot represent themselves, and catastrophic risks may require expertise. But expertise does not erase public accountability. In design, this means building contestability, audit, appeal, transparency, and refusal conditions into the system.

<!-- phil-section-id: ch16-s041 -->
## Conclusion: Take The Future Seriously Without Letting It Become A Blank Check

<!-- phil-passage-id: ch16-p0230 -->
Effective Altruism and existential-risk thinking ask us to widen moral attention across distance, time, scale, and uncertainty. Singer widens concern to distant suffering. Evidence-based charity evaluation asks whether our help actually helps. Parfit shows why future people complicate moral accounting. Bostrom argues that some risks threaten humanity's entire future. Ord and MacAskill make the long-term future a public moral priority. AI alignment asks whether powerful systems will preserve what humans actually value rather than merely optimize a proxy. Frontier-lab frameworks show how these ideas can become thresholds, evaluations, safety cases, and governance procedures.

<!-- phil-passage-id: ch16-p0231 -->
The lens forces attention to future people, irreversible harm, and consequences that a short-term analysis can miss. It becomes dangerous when it overwhelms every other moral question. A forecast about the future can support safeguards. It can also become a reason for private labs, donors, and expert networks to make decisions for everyone else.

<!-- phil-passage-id: ch16-p0232 -->
The responsible position is harder than panic and harder than dismissal. Future stakes can constrain action. Uncertainty can justify proportionate safeguards and contestable governance. Present people remain stakeholders. Future people are morally relevant. No one gets a blank check simply by claiming to speak for them.

<!-- phil-passage-id: ch16-p0233 -->
For PHIL 123, apply the lens to the same documented case you have been studying. Name the assumptions, widen the stakeholder map, test the effectiveness claims, identify the proxies, check reversibility and contestability, and state what evidence would make a responsible decision-maker pause, revise, or stop.

<!-- phil-section-id: ch16-s042 -->
## References

<!-- phil-section-id: ch16-s043 -->
### Effective Altruism, impartiality, and institutions

<!-- phil-passage-id: ch16-p0234 -->
- Centre for Effective Altruism. [Our history](https://www.centreforeffectivealtruism.org/history). Used for Giving What We Can, 80,000 Hours, CEA, and the adoption of the term "effective altruism."
- Coefficient Giving. [Our History](https://coefficientgiving.org/our-history/). Used for GiveWell Labs, Open Philanthropy, Coefficient Giving, and cause-selection criteria.
- Effective Altruism. [What is effective altruism?](https://www.effectivealtruism.org/articles/introduction-to-effective-altruism). Used for public movement self-description and cause-prioritization language.
- GiveWell. [About GiveWell](https://www.givewell.org/about). Used for evidence-based charity evaluation, cost-effectiveness, and founding date.
- Singer, Peter. [About Peter Singer](https://www.petersinger.info/about). Used for Singer's own summary of his influence on Effective Altruism, the drowning-child case, equal consideration, and effective giving.
- Singer, Peter. (1972). ["Famine, Affluence, and Morality"](https://www.jstor.org/stable/2265052). Used for the rescue argument and distance/proximity reasoning.
- Singer, Peter. (1975/2023). [*Animal Liberation Now*](https://www.harpercollins.com/products/animal-liberation-now-peter-singer). Used for equal consideration of interests and Singer's broader applied-ethics context.
- Stanford Encyclopedia of Philosophy. [Henry Sidgwick](https://plato.stanford.edu/entries/sidgwick/). Used for Sidgwick's place in the classical utilitarian tradition and influence on Singer and Parfit.

<!-- phil-section-id: ch16-s044 -->
### Parfit, future people, and population ethics

<!-- phil-passage-id: ch16-p0235 -->
- Arrhenius, Gustaf, Jesper Ryberg, and Torbjörn Tännsjö. [The Repugnant Conclusion](https://plato.stanford.edu/entries/repugnant-conclusion/). Stanford Encyclopedia of Philosophy. Used for Parfit's population-ethics challenge.
- Parfit, Derek. (1984). *Reasons and Persons*. Used for future generations, nonidentity, and population ethics.
- Roberts, Melinda A. [The Nonidentity Problem](https://plato.stanford.edu/entries/nonidentity-problem/). Stanford Encyclopedia of Philosophy. Used for Parfit's nonidentity problem and future-person cases.

<!-- phil-section-id: ch16-s045 -->
### Existential risk, longtermism, and decision under uncertainty

<!-- phil-passage-id: ch16-p0236 -->
- Bostrom, Nick. (2002). ["Existential Risks: Analyzing Human Extinction Scenarios and Related Hazards"](https://nickbostrom.com/papers/existential-risks/). Used for the definition of existential risk.
- Bostrom, Nick. (2003). ["Astronomical Waste"](https://nickbostrom.com/papers/astronomical-waste/). Used for astronomical-stakes reasoning.
- Bostrom, Nick. (2009). ["Pascal's Mugging"](https://academic.oup.com/analysis/article-pdf/69/3/443/325383/anp062.pdf). Used for tiny-probability / huge-payoff vulnerability.
- Bostrom, Nick. (2013). ["Existential Risk Prevention as Global Priority"](https://www.globalpolicyjournal.com/articles/global-commons-and-environment/existential-risk-prevention-global-priority). Used for global-priority reasoning around existential risk.
- Bostrom, Nick. (2019). ["The Vulnerable World Hypothesis"](https://www.globalpolicyjournal.com/articles/global-public-goods-and-bads/vulnerable-world-hypothesis). Used for black-ball reasoning and technological vulnerability.
- Greaves, Hilary, and William MacAskill. ["The Case for Strong Longtermism"](https://academic.oup.com/book/60794/chapter/530063399). Used for academic longtermism and far-future priority reasoning.
- Lenman, James. (2000). ["Consequentialism and Cluelessness"](https://philpapers.org/rec/LENCAC-3). Used for long-run action-guidance concerns.
- MacAskill, William. [*What We Owe the Future*](https://www.williammacaskill.com/what-we-owe-the-future). Used for public longtermism context.
- Ord, Toby. [*The Precipice*](https://theprecipice.com/). Used for existential security and public existential-risk synthesis.
- Tarsney, Christian. (2023). ["The Epistemic Challenge to Longtermism"](https://philarchive.org/rec/TARTEC-4). Used for forecastability and Pascalian-dependence concerns.
- Tarsney, Christian, Teruji Thomas, and William MacAskill. [Moral Decision-Making Under Uncertainty](https://plato.stanford.edu/entries/moral-decision-uncertainty/). Stanford Encyclopedia of Philosophy. Used for decision under uncertainty and moral uncertainty.

<!-- phil-section-id: ch16-s046 -->
### AI alignment and AI safety

<!-- phil-passage-id: ch16-p0237 -->
- Bostrom, Nick. ["Ethical Issues in Advanced Artificial Intelligence"](https://nickbostrom.com/ethics/ai). Used for the paperclip maximizer and misaligned optimization.
- Bostrom, Nick. (2012). ["The Superintelligent Will"](https://nickbostrom.com/superintelligentwill.pdf). Used for orthogonality and instrumental convergence.
- Center for Human-Compatible AI. [Home / Mission](https://humancompatible.ai/). Used for Stuart Russell / CHAI's human-compatible AI frame.
- Yudkowsky, Eliezer. (2008). ["Artificial Intelligence as a Positive and Negative Factor in Global Risk"](https://intelligence.org/files/AIPosNegFactor.pdf). Used for early AI safety, Friendly AI, and control-problem framing.

<!-- phil-section-id: ch16-s047 -->
### Contemporary AI-risk statements, scenarios, and frameworks

<!-- phil-passage-id: ch16-p0238 -->
- AI 2027. [AI 2027](https://ai-2027.com/). Used as a detailed scenario artifact, not as consensus prediction.
- Anthropic. [Responsible Scaling Policy](https://www.anthropic.com/responsible-scaling-policy). Used for company threshold governance; version 3.3 effective May 26, 2026.
- Anthropic. [The Long-Term Benefit Trust](https://www.anthropic.com/news/the-long-term-benefit-trust). Used for long-term public-benefit corporate governance example.
- Center for AI Safety. [Statement on AI Extinction Risk](https://safe.ai/work/statement-on-ai-extinction-risk). Used for the public extinction-risk statement and signatory context.
- Epoch AI. David Owen. ["What will AI look like in 2030?"](https://epoch.ai/publications/what-will-ai-look-like-in-2030). Used as a 2030 forecast/scenario comparison source; notes that the report was commissioned by Google DeepMind and that conclusions are the author's.
- Future of Life Institute. [Asilomar AI Principles](https://futureoflife.org/open-letter/ai-principles/). Used for human control, value alignment, and catastrophic/existential-risk planning principles.
- Future of Life Institute. [Statement on Superintelligence](https://superintelligence-statement.org/). Used for the public call to prohibit superintelligence development until safety/control consensus and public buy-in conditions are met.
- Google DeepMind. [Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/). Used for safety cases, capability thresholds, tracked capability levels, and frontier governance examples.
- Hinton, Geoffrey, as reported by Dan Milmo. ["'Godfather of AI' shortens odds of the technology wiping out humanity over next 30 years"](https://www.theguardian.com/technology/2024/dec/27/godfather-of-ai-raises-odds-of-the-technology-wiping-out-humanity-over-next-30-years). *The Guardian*. Used as secondary attribution for Hinton's 10 to 20 percent estimate.
- OECD. Hobbs, H., Docherty, D., Aranda, L., Sugimoto, K., Perset, K., and Kierzenkowski, R. [*Exploring possible AI trajectories through 2030*](https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/02/exploring-possible-ai-trajectories-through-2030_b6fb75d9/cb41117a-en.pdf). Used as international scenario-planning source; scenarios are plausible but uncertain, not predictions.
- OpenAI. [Charter](https://openai.com/charter/). Used for AGI/all-humanity mission framing.
- OpenAI. [Preparedness Framework v2](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf). Used for severe-risk categories, thresholds, safeguards, and governance example.
- UK Government Office for Science. [AI Scenarios 2030: Helping policymakers plan for the future of AI](https://www.gov.uk/government/publications/ai-scenarios-2030-helping-policymakers-plan-for-the-future-of-ai/ai-scenarios-2030-helping-policymakers-plan-for-the-future-of-ai). Used as a policy scenario-planning source; document states that it is not a statement of policy.

<!-- phil-section-id: ch16-s048 -->
### Cultural prehistory and critique

<!-- phil-passage-id: ch16-p0239 -->
- Bulletin of the Atomic Scientists. [Doomsday Clock](https://thebulletin.org/doomsday-clock/). Used for post-1945 existential-risk imagery and nuclear-risk public framing.
- Gebru, Timnit, and Émile P. Torres. (2024). ["The TESCREAL bundle"](https://firstmonday.org/ojs/index.php/fm/article/view/13636). Used as a critique source for ideological and institutional-power concerns; treated as contested critique rather than neutral taxonomy.
- Jecker, Nancy, Caesar Atuire, Jean-Christophe Bélisle-Pipon, Vardit Ravitsky, and Anita Ho. (2024). ["AI and the falling sky: interrogating X-Risk"](https://doi.org/10.1136/jme-2023-109702). Used as a present-harm displacement critique source.
- Lechterman, Theodore M. (2020). ["The Effective Altruist's Political Problem"](https://www.journals.uchicago.edu/doi/abs/10.1086/706867). Used for democratic legitimacy and philanthropy-power critique.
- Malthus, Thomas Robert. (1798). [*An Essay on the Principle of Population*](https://www.gutenberg.org/ebooks/4239). Used for secular scarcity and population-catastrophe genealogy.
- PBS FRONTLINE. [Apocalypticism Explained](https://www.pbs.org/wgbh/pages/frontline/shows/apocalypse/explanation/). Used for accessible background on apocalyptic tradition.
- Shelley, Mary. (1818). [*Frankenstein; or, The Modern Prometheus*](https://www.gutenberg.org/ebooks/84). Used as background for creator responsibility and artificial-life genealogy.
- Vallor, Shannon. (2024). [*The AI Mirror: How to Reclaim Our Humanity in an Age of Machine Thinking*](https://global.oup.com/academic/product/the-ai-mirror-9780197759066). Used for humanistic critique of AI discourse and present-stakes displacement.
