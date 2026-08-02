# Practical Wisdom After Aristotle: Vallor, Askell, and the Problem of Machine Judgment

<!-- phil-section-id: ch08-s001 -->
## A Careful Answer That Still Leaves You Responsible

<!-- phil-passage-id: ch08-p0001 -->
Imagine a student named Maya applying to a competitive nursing program. The application asks for a personal statement about a time she cared for someone during a hard stretch. She wants to write about her grandmother's last year, when Maya moved home for the summer and did most of the day-to-day work of feeding, bathing, and keeping her grandmother company. The story is real. It also feels enormous and slippery, and she has fourteen days.

<!-- phil-passage-id: ch08-p0002 -->
Maya opens Claude and asks for help. She pastes a rough paragraph. She tells Claude the story, the prompt, and that she is worried her writing sounds flat. Claude gives her a careful answer. It asks what her grandmother taught her about care. It suggests she anchor the essay in one specific afternoon of that summer. It flags a line where Maya says "I learned so much" and asks her what, exactly, she learned. It offers a rewritten paragraph that keeps her sentences and rhythms but tightens the ending.

<!-- phil-passage-id: ch08-p0003 -->
Then Claude does something else. Maya asks whether she should tell the admissions committee that she used Claude to help revise. Claude walks her through it. It notes that some programs distinguish AI-assisted editing from AI-generated content. It asks her whether her school has a policy. It says that she is the one who has to judge whether the essay still reads as hers, and whether disclosure will help or hurt her application depending on the culture of the specific program.

<!-- phil-passage-id: ch08-p0004 -->
The advice is useful. Maya learns from it. She also has to decide.

<!-- phil-passage-id: ch08-p0005 -->
She has to decide what she is willing to keep from Claude's suggested paragraph and what she wants to say in her own words. She has to decide what her nursing school's actual policy is, not what Claude thinks it might be. She has to decide whether disclosing the AI help matters for her sense of honesty, apart from whether it will affect the admissions outcome. And underneath all of this, she has to notice something Claude cannot notice for her: that she has been using Claude a lot lately, that she is starting to reach for it before she reaches for her own thinking, and that she cannot tell yet whether the tool is helping her write better or helping her avoid the discomfort of writing.

<!-- phil-passage-id: ch08-p0006 -->
The question the chapter starts with is simple. Is what Claude did here rule lookup, useful assistance, or something closer to judgment? And however we answer that, what remains Maya's to do?

<!-- phil-passage-id: ch08-p0007 -->
This chapter takes those questions seriously by moving through three positions that share a common ancestor. Aristotle gave us the concept of practical wisdom, or *phronesis*, as situated human judgment formed through character, habit, and experience. Shannon Vallor, a philosopher of technology, adapts Aristotle's practical wisdom into what she calls *technomoral wisdom*, arguing that human beings living in a digital world need a version of practical wisdom trained for tools that reshape how we pay attention, form habits, and extend care. Amanda Askell, a philosopher at Anthropic and the primary author of Claude's current Constitution, uses the language of virtue, wisdom, judgment, values, and character to describe what Anthropic is trying to build into Claude itself. Vallor is talking about human beings using technology. Askell is talking about a technology being trained to behave with something like practical judgment. Aristotle sits under both.

<!-- phil-passage-id: ch08-p0008 -->
The chapter compares those adaptations long enough to see what they share, then marks where the analogy breaks. The comparison only works if it stops where the analogy fails.

<!-- phil-section-id: ch08-s002 -->
## What Aristotle Left Us

<!-- phil-passage-id: ch08-p0009 -->
Aristotle's virtue ethics needs only a short reminder here.

<!-- phil-passage-id: ch08-p0010 -->
For Aristotle, ethics was, at bottom, the formation of character over a life. A person becomes just by doing just things until justice becomes part of who they are. A person becomes honest by telling the truth in small hard moments until the honesty is theirs. Character shows up as stable dispositions, cultivated through practice, guided by reason, and lived inside particular communities and relationships.

<!-- phil-passage-id: ch08-p0011 -->
Virtue is the good version of these dispositions. Vice is the bad version. Between the two, Aristotle located a specific kind of intellectual excellence he called *phronesis*: practical wisdom. Practical wisdom is not general intelligence, not book learning, not cleverness about means, and not moral rule-following. It is the trained capacity to see what a concrete situation calls for and to choose well in that situation, guided by good character and refined by experience.

<!-- phil-passage-id: ch08-p0012 -->
*Phronesis* matters because ethical life keeps producing cases the rules do not fully settle. Someone tells you a hard truth about a friend and asks you not to repeat it. Someone offers you help you did not ask for. Someone gives you access to a tool that makes work easier and makes cheating easier at the same time. Rules can guide you here. But rules also run out. What happens after they run out is what Aristotle was pointing at.

<!-- phil-passage-id: ch08-p0013 -->
Practical wisdom takes time. It is cultivated through repeated action, in the company of models who already have some of it, inside communities that recognize what a good life looks like. Practical wisdom is not the property of any single virtue. It is the connective tissue that lets courage, honesty, care, and self-control show up rightly in the moment. Without it, courage tips into recklessness and honesty tips into cruelty.

<!-- phil-passage-id: ch08-p0014 -->
Aristotle assumed that all of this unfolded in a human being across a lifetime. That assumption makes the comparison with a trained model difficult.

<!-- phil-section-id: ch08-s003 -->
## Vallor and the Adaptation for Digital Life

<!-- phil-passage-id: ch08-p0015 -->
Shannon Vallor is a philosopher of technology who takes Aristotle seriously as a starting point and then asks a hard question. What happens to virtue ethics when the environment in which humans form character is saturated with digital technologies? Her 2016 book *Technology and the Virtues: A Philosophical Guide to a Future Worth Wanting* (Oxford University Press) works out an answer.

<!-- phil-passage-id: ch08-p0016 -->
Vallor takes Aristotle as an inheritance and updates him. She keeps the core: virtue as cultivated character, habit as the medium of formation, practical wisdom as the integrating capacity. Her contribution is different. The environments where character forms in the twenty-first century are heavily shaped by tools that were built for purposes other than virtue. Smartphones, feeds, search engines, recommender systems, workplace software, learning management systems, generative AI. All of these change what we notice, what we practice, what we feel entitled to, and what we care about, whether we intend that or not.

<!-- phil-passage-id: ch08-p0017 -->
Vallor calls the excellences human beings need in this environment *technomoral virtues*. She calls the integrating capacity that binds them *technomoral wisdom*. Technomoral wisdom is her adaptation of Aristotelian practical wisdom for a technologically mediated life.

<!-- phil-passage-id: ch08-p0018 -->
Two clarifications before going further. First, Vallor is writing about human beings. Her virtues describe traits humans cultivate and technomoral wisdom is a capacity humans develop, not a property of any device. Second, Vallor is not replacing Aristotle. She thinks Aristotle got something enduring right about how character forms. Her claim is that Aristotle's framework needs updating because the raw material of habit, attention, and desire is now shaped by artifacts and platforms that Aristotle could not have imagined.

<!-- phil-passage-id: ch08-p0019 -->
Vallor identifies five ways technology changes human moral life. Aristotle could recognize each problem even though the particular tools would surprise him.

<!-- phil-section-id: ch08-s004 -->
## What the Interface Teaches You to Notice

<!-- phil-passage-id: ch08-p0020 -->
Vallor's first move is about attention. She argues that becoming a person of practical wisdom requires *moral attention*: the trained capacity to notice what matters in a concrete situation before you decide what to do about it. Attention is prior to deliberation. You cannot deliberate well about a problem you have not fully seen.

<!-- phil-passage-id: ch08-p0021 -->
Technologies shape moral attention because they foreground some features of a situation and hide others. The effect follows from interface design.

<!-- phil-passage-id: ch08-p0022 -->
Return to Maya. When she opens Claude, the interface foregrounds a text box, a stream of helpful suggestions, and a rapid feedback loop. It does not foreground the fact that her school has an actual disclosure policy she has not read. It does not foreground the emotional texture of the summer she is writing about. It does not foreground the possibility that the essay she is drafting today will look different to her in six months. Claude can be prompted to raise any of these. It rarely raises them on its own.

<!-- phil-passage-id: ch08-p0023 -->
Compare this to what she would notice if she were writing the essay by hand at her grandmother's old kitchen table. The environment there foregrounds different things. The room itself, the smell of the house, the pull of memory. Neither environment is neutral. Each one trains her attention toward particular features of her situation and away from others.

<!-- phil-passage-id: ch08-p0024 -->
Vallor's point is that this attentional shaping is a moral matter. If a tool consistently trains you not to notice the invisible people affected by your choices, you may become the kind of person who does not notice them, whether or not you intend that. If a tool trains you to feel every hesitation as an obstacle to smooth output, you may become someone who mistakes hesitation for failure. Moral attention is a habit. Habits form through repetition. Repetition happens on the interfaces where you spend your time.

<!-- phil-passage-id: ch08-p0025 -->
For a student using AI, this becomes a concrete practice question. When Claude drafts a paragraph about your grandmother, what is it teaching you to notice about your writing, your memory, and your task? What is it teaching you to skim past? A person cultivating technomoral wisdom does not have to refuse the tool. They have to learn to see what the tool is teaching them to see, and to hold open the parts it leaves out.

<!-- phil-passage-id: ch08-p0026 -->
<aside class="textbox shaded textbox--key-point" role="note" aria-labelledby="callout-key-point-attention">
<h3 id="callout-key-point-attention">Key Point: Technology Shapes Moral Attention</h3>
<p>Vallor argues that practical wisdom starts with moral attention: noticing what matters in a situation before deciding what to do. Digital tools train attention whether we intend them to or not. They make some features of a situation vivid and let others fade. A person developing technomoral wisdom asks, of each tool they use often, what it is teaching them to notice and what it is teaching them to overlook.</p>
</aside>

<!-- phil-section-id: ch08-s005 -->
## Repeated Use, Trained Character

<!-- phil-passage-id: ch08-p0027 -->
Vallor's second move is about habit. Aristotle already thought that repeated action forms character. Vallor's addition is that a huge share of our repeated action now runs through tools designed by other people for other reasons.

<!-- phil-passage-id: ch08-p0028 -->
Consider what Maya has been doing for the past semester. She has used Claude for reading summaries, for essay revision, for study questions before an exam, for figuring out what to say in an awkward email to a professor. Each of those uses is small. None of them is obviously a moral event. Taken together, they add up to a pattern of practice.

<!-- phil-passage-id: ch08-p0029 -->
Vallor uses the language of *moral habituation* to describe how tool use forms character. She also introduces two terms that are more specifically technological. In her 2015 article [*Moral Deskilling and Upskilling in a New Machine Age*](https://scholarcommons.scu.edu/phi/7/), Vallor argues that technologies can either *upskill* human beings morally, giving us more opportunities and better environments in which to practice virtue, or *deskill* us morally, removing the situations in which certain moral capacities are exercised until we lose the capacities themselves.

<!-- phil-passage-id: ch08-p0030 -->
Moral deskilling does not mean forgetting a rule. It means losing the practical capacity to act well because the situations that used to demand that capacity have been outsourced, automated, or smoothed away. If a workplace uses software that handles every difficult conversation with a template, the workers there may lose the practiced skill of handling difficult conversations. If a student uses AI to smooth every awkward email, they may lose the practiced skill of writing an awkward email that says what it needs to say.

<!-- phil-passage-id: ch08-p0031 -->
Upskilling is possible too. A person can use AI in ways that create more chances to practice moral discernment, not fewer. Maya could use Claude to draft several possible openings and then think hard about which one is honest to what she experienced. She could use it to ask herself questions she was avoiding. She could use it as a foil, arguing with it when its suggestions flatten what she is trying to say. Whether the tool trains her or numbs her depends on how she uses it, over time, in the company of the people around her.

<!-- phil-passage-id: ch08-p0032 -->
This gives Vallor a clear standard for evaluating any technology in a life. The relevant question is not whether the tool worked today. The relevant question is what the tool is training its user to become across many days of use. That question cannot be answered by a single interaction. It has to be tracked.

<!-- phil-passage-id: ch08-p0033 -->
For a student, this is where honesty about one's own practice starts to matter. Notice the habit before it hardens. Notice which tasks you now avoid without help. Notice which capacities you used to have and which ones are getting rusty. That noticing is itself a practice of moral attention.

<!-- phil-section-id: ch08-s006 -->
## Judgment When the Rules Run Out

<!-- phil-passage-id: ch08-p0034 -->
Vallor's third move is about deliberation under uncertainty, which she calls *prudential judgment*. This is her closest translation of Aristotelian *phronesis* into her technomoral vocabulary.

<!-- phil-passage-id: ch08-p0035 -->
Prudential judgment is the trained capacity to deliberate well about what to do in a concrete situation whose outcomes are uncertain. Rules and policies can guide this. They cannot replace it. Someone deliberating prudentially draws on their character, their experience, their attention, and their sense of what the good is here, and decides.

<!-- phil-passage-id: ch08-p0036 -->
Vallor stresses two features of prudential judgment. First, it is not the same as clever means-end reasoning. A person can be extremely good at getting what they want and terrible at judging what is worth wanting. Second, prudential judgment is not the same as flexible rationalization. A wise person is not someone who bends every principle to fit the case. A wise person distinguishes real ethical particulars from the temptation to make an exception because it is convenient.

<!-- phil-passage-id: ch08-p0037 -->
Digital environments make prudential judgment harder in specific ways. Outcomes are hard to predict when the systems involved are large and opaque. Consequences ripple through networks whose reach you cannot see. Small choices scale in ways ordinary experience did not prepare us for. A single click can share an image with millions of strangers. A single prompt can generate content that will be treated by others as authoritative.

<!-- phil-passage-id: ch08-p0038 -->
None of that makes deliberation impossible. It makes deliberation more demanding. It puts more weight on the traits that let a person deliberate well when they cannot see the full picture: humility, patience, the discipline to slow down, the willingness to name what you do not know.

<!-- phil-passage-id: ch08-p0039 -->
For Maya, prudential judgment shows up in the question about disclosure. No rule will settle whether she should tell the admissions committee she used Claude. She can look up a policy, read a culture, consult an ethical intuition, and check in with a self she is trying to become. Prudential judgment integrates those pieces. Claude can help her see the pieces. It cannot do the integrating.

<!-- phil-section-id: ch08-s007 -->
## Whose Interests Show Up

<!-- phil-passage-id: ch08-p0040 -->
Vallor's fourth move is about the scope of moral concern. Practical wisdom, on her account, includes a trained capacity to judge who deserves moral consideration in a situation, how much, and in what way. She calls this the appropriate extension of moral concern.

<!-- phil-passage-id: ch08-p0041 -->
Digital tools change how moral concern extends because they change who is present in a situation. Some people become visible to us who would not have been visible before. Someone across the world posts something you can read. Someone anonymous uses a model whose training data included your writing. Someone downstream is affected by an algorithmic decision made without their knowledge.

<!-- phil-passage-id: ch08-p0042 -->
At the same time, digital tools make some people less visible. The invisible workers who label training data. The users of a system built for one population and deployed against another. The stakeholders whose interests were traded away in a design decision made years ago.

<!-- phil-passage-id: ch08-p0043 -->
A person developing technomoral wisdom learns to ask, of the systems they use, who is in the room they are not seeing. That is not paranoia. It is a practiced habit of moral attention widened to fit the scope of the tools involved.

<!-- phil-passage-id: ch08-p0044 -->
For Maya writing her essay, the extension of concern is small and concrete. Her grandmother is in the room in a specific way, even though she has died. The admissions committee is in the room. Other applicants are in the room, because if AI-assisted editing gives Maya a significant advantage that others cannot access, that changes the ethical texture of what she is doing. Her future patients are in the room, if her essay is helping to decide whether she becomes a nurse. Claude cannot notice most of those people for her. It can be prompted to raise them. It will not raise them on its own.

<!-- phil-section-id: ch08-s008 -->
## The Integrating Virtue

<!-- phil-passage-id: ch08-p0045 -->
Vallor's last move is that all of this comes together in a single capacity: technomoral wisdom. Technomoral wisdom is not one more virtue in a list. It is the integrating capacity that lets moral attention, habituated character, prudential judgment, and extended concern show up together in a specific case.

<!-- phil-passage-id: ch08-p0046 -->
This is Vallor's most direct adaptation of Aristotelian *phronesis*. Where Aristotle's practical wisdom integrates the virtues in the context of a human life, Vallor's technomoral wisdom integrates them in the context of a life mediated by powerful and rapidly changing technologies. It is a capacity, not a rule set. It has to be cultivated. It is only ever partially achieved.

<!-- phil-passage-id: ch08-p0047 -->
Vallor uses this integrating idea to justify a longer list of technomoral virtues in *Technology and the Virtues*. She names honesty, self-control, humility, justice, courage, empathy, care, civility, flexibility, perspective, magnanimity, and technomoral wisdom itself as the twelve she considers central for twenty-first-century technomoral life. She is careful to say the list is revisable. The list is a proposal that responds to a set of pressures, not a memorization exercise.

<!-- phil-passage-id: ch08-p0048 -->
For the purposes of this chapter, six of Vallor's twelve are especially useful for thinking about AI use.

<!-- phil-passage-id: ch08-p0049 -->
*Honesty* asks whether you are truthful about what you know, what your tools produced, and where your work came from. This applies to disclosure of AI use, to accurate citation, to naming when a source or a model has misled you, and to being honest with yourself about what you have and have not done.

<!-- phil-passage-id: ch08-p0050 -->
*Self-control* asks whether you can resist the pull of frictionless assistance when the friction was the point. Writing something hard is part of thinking something through. A person of self-control uses AI without letting it eat the practice.

<!-- phil-passage-id: ch08-p0051 -->
*Humility* asks whether you can hold uncertainty without pretending it away. Models are confident. Interfaces are polished. A humble user notices when a confident answer is thin, when a fluent explanation is guessing, when a suggestion sounds right and might still be wrong.

<!-- phil-passage-id: ch08-p0052 -->
*Care* asks whether the people affected by your tool use are visible to you and treated with the concern they deserve. Care is not sentimentality. It is the practiced habit of noticing whose good is at stake in what you are doing.

<!-- phil-passage-id: ch08-p0053 -->
*Perspective* asks whether you can step outside a single interaction and see the pattern. Perspective is what lets you notice that this session is the twentieth in a row where you asked Claude the same kind of question, and that the pattern might be doing something to you that no single session did.

<!-- phil-passage-id: ch08-p0054 -->
*Technomoral wisdom* is the integrating capacity that lets the other five show up together. It is not a rule for combining virtues. It is a trained sensitivity to what this case, in this environment, actually calls for.

<!-- phil-passage-id: ch08-p0055 -->
<aside class="textbox shaded textbox--framework-map" role="note" aria-labelledby="callout-map-three">
<h3 id="callout-map-three">Framework Map: Aristotle, Vallor, Askell/Anthropic</h3>
<dl>
<dt><strong>Aristotle</strong></dt>
<dd>Practical wisdom (<em>phronesis</em>) is situated human judgment formed through character, habit, and experience over a life. It integrates the virtues in concrete cases where rules do not fully settle what to do.</dd>
<dt><strong>Vallor</strong></dt>
<dd>Technomoral wisdom is Aristotle's practical wisdom adapted for human beings living through digital technologies. Technologies shape human attention, habit, moral skill, desire, and concern, so virtue ethics has to work at that scale of formation.</dd>
<dt><strong>Askell / Anthropic</strong></dt>
<dd>Anthropic uses the English language of practical wisdom, judgment, values, virtue, character, and hard constraints in Claude's Constitution and character training. On the interpretation this chapter takes, Anthropic is trying to train something like practical wisdom into Claude's behavior. Whether that succeeds, and what it could mean if it did, are open questions.</dd>
</dl>
</aside>

<!-- phil-section-id: ch08-s009 -->
## The Same Language Turned on the Machine

<!-- phil-passage-id: ch08-p0056 -->
So far the chapter has stayed on ground Aristotle and Vallor would recognize as their own. Both are describing human beings becoming the kind of people who can act well in complicated situations, one in ancient Greece and one in a world of smartphones and recommender systems. The tools matter because they shape the people. The people are still the moral subjects.

<!-- phil-passage-id: ch08-p0057 -->
The vocabulary of practical wisdom is also being applied to the AI system itself.

<!-- phil-passage-id: ch08-p0058 -->
Amanda Askell is a philosopher at Anthropic and the primary author of the current version of [Claude's Constitution](https://www.anthropic.com/constitution). If you read the Constitution and Anthropic's related public documents, you notice that the language of practical wisdom, judgment, values, virtue, wisdom, character, and hard constraints is not being used to describe Claude's users. It is being used to describe Claude.

<!-- phil-passage-id: ch08-p0059 -->
That shift changes the question. Vallor asks how humans can develop practical wisdom in a technological environment. Anthropic is asking how a piece of technology can be trained to behave in ways that look like practical wisdom. Those questions are not the same. They share a vocabulary. They point at different problems.

<!-- phil-passage-id: ch08-p0060 -->
The boundary needs to be explicit. Anthropic uses English words like practical wisdom, judgment, and character explicitly, and paraphrases of those words appear across their public documents. The chapter treats those as verified. The chapter also interprets what Anthropic is doing through an Aristotelian and phronetic lens. That interpretation is the chapter's, not necessarily Anthropic's. When the analogy holds it will be marked. When it breaks it will also be marked.

<!-- phil-passage-id: ch08-p0061 -->
<aside class="textbox shaded textbox--caution" role="note" aria-labelledby="callout-caution-verified">
<h3 id="callout-caution-verified">Caution: Practical Wisdom Is Verified; <em>Phronesis</em> Is Our Lens</h3>
<p>Anthropic's public documents explicitly use the English language of practical wisdom, judgment, values, virtue, wisdom, and character to describe what they are trying to train into Claude. This chapter reads that language through the Aristotelian tradition of <em>phronesis</em> that runs through Vallor. That reading is our interpretive frame. Do not attribute the Greek word <em>phronesis</em> to Askell or Anthropic unless a primary source uses it. Do not conclude that Claude is virtuous or wise in the way a human being can be. Anthropic is trying to train something like practical wisdom into Claude. Whether that description is philosophically apt is one of the questions this chapter asks you to hold open.</p>
</aside>

<!-- phil-section-id: ch08-s010 -->
## A Document That Tries to Constitute Something

<!-- phil-passage-id: ch08-p0062 -->
[Claude's Constitution](https://www.anthropic.com/constitution) is a public document Anthropic uses to guide Claude's training and behavior. Anthropic released a substantially revised version in early 2026 and explained the change in a companion post, [*Claude's new constitution*](https://www.anthropic.com/news/claude-new-constitution). Amanda Askell is the primary author.

<!-- phil-passage-id: ch08-p0063 -->
The Constitution uses virtue-ethical vocabulary and explains when Anthropic expects rules or judgment to guide Claude.

<!-- phil-passage-id: ch08-p0064 -->
The first is the vocabulary. The document does not read like a compliance manual. It reads like an attempt to describe a character. It talks about the kind of values Anthropic wants Claude to hold, the kind of judgment Anthropic hopes Claude can exercise, the kind of wisdom Anthropic is trying to cultivate. It uses the phrase "practical wisdom." It uses the words virtue, wisdom, and character. It also uses the phrase "hard constraints" to describe behaviors that Claude should never perform regardless of context.

<!-- phil-passage-id: ch08-p0065 -->
The second is the way the document positions rules and judgment relative to each other. The Constitution states, in broadly the following spirit, that Anthropic prefers to train Claude toward good values and sound judgment. Strict rule-following is used sparingly, mostly as a backstop. The reason is that novel situations do not always fit rules, and a model that has internalized values and something like practical judgment may generalize better than one that has memorized a list of prohibitions. At the same time, the Constitution keeps hard constraints for a small set of behaviors where the risks of getting it wrong are too high to trust judgment alone.

<!-- phil-passage-id: ch08-p0066 -->
Each account treats rules as incomplete in some situations. Aristotle thought practical wisdom was needed where rules ran out. Vallor thought technomoral wisdom was needed because rigid procedures cannot track novel technosocial cases. Anthropic is now saying, about Claude, that something like judgment is needed because rules cannot cover every situation the model will face, and that hard constraints backstop the judgment for the cases where the stakes leave no room for error.

<!-- phil-passage-id: ch08-p0067 -->
The parallel has evidence behind it. Anthropic's public materials about Claude's Constitution and character use virtue-ethical vocabulary to describe what the company wants Claude to become behaviorally. That evidence does not establish that Claude has Aristotelian virtue.

<!-- phil-passage-id: ch08-p0068 -->
<aside class="textbox shaded textbox--framework-map" role="note" aria-labelledby="callout-map-rules">
<h3 id="callout-map-rules">Framework Map: Rules, Values, Judgment, Hard Constraints</h3>
<dl>
<dt><strong>Rules</strong></dt>
<dd>Explicit prescriptions or prohibitions that specify what to do or not do in defined situations. Useful when situations are predictable and well-defined. Weaker when situations are novel or complex.</dd>
<dt><strong>Values</strong></dt>
<dd>Deeper commitments that shape how an agent interprets a situation and decides what matters in it. Anthropic's Constitution describes what kinds of things Claude should care about, not only what it should do.</dd>
<dt><strong>Judgment</strong></dt>
<dd>Context-sensitive discernment about what a specific situation calls for, given the values in play and the particulars of the case. Anthropic hopes Claude's behavior in unfamiliar cases will draw on trained judgment that goes beyond pattern-matching against fixed rules.</dd>
<dt><strong>Hard constraints</strong></dt>
<dd>A small set of behaviors treated as off-limits regardless of context. Anthropic keeps hard constraints in the Constitution for cases where the risks of trusting judgment are too high, including help with weapons of mass destruction and certain forms of manipulation.</dd>
</dl>
</aside>

<!-- phil-section-id: ch08-s011 -->
## Training Judgment and the Reasons Behind It

<!-- phil-passage-id: ch08-p0069 -->
The Constitution is a document. Claude is a trained model. Those are two different things. A student reading this chapter should hold that distinction open, because much of the interesting philosophical question sits inside it.

<!-- phil-passage-id: ch08-p0070 -->
Recent research makes Anthropic's goal less speculative without settling whether models possess anything like virtue. Seth Lazar's [overview of LLM moral competence](https://blog.cosmos-institute.org/p/the-construction-of-moral-character) argues that frontier models already show meaningful facility in identifying morally relevant features and constructing moral arguments in many text-based cases. For character training, the harder question is whether that local facility becomes reliable behavior and coherent judgment in unfamiliar situations. Moral-reasoning facility is a starting point for Anthropic's project, not proof that a model has *phronesis*.

<!-- phil-passage-id: ch08-p0071 -->
Two of Anthropic's public documents should be named here. [*Claude's Character*](https://www.anthropic.com/research/claude-character) describes an attempt to train Claude toward stable traits such as intellectual curiosity, honesty, care for people it is talking with, and a willingness to disagree with users when they are wrong. Anthropic frames this as an alignment intervention, meaning something more than customer-service polish. The claim is that if Claude has trained dispositions of a certain kind, its behavior in unfamiliar situations will draw on those dispositions. It will not degrade into surface-level rule lookup.

<!-- phil-passage-id: ch08-p0072 -->
[*Teaching Claude Why*](https://alignment.anthropic.com/2026/teaching-claude-why/) describes work on training Claude to understand and internalize the reasoning behind constitutional commitments, going beyond memorization of the commitments themselves. The idea is that a model that grasps *why* a certain behavior is required is more likely to generalize the underlying value to a case the training set did not anticipate. A model that has only memorized the surface rule may fail on any case that does not match the rule exactly.

<!-- phil-passage-id: ch08-p0073 -->
These two projects use a broadly virtue-ethical vocabulary. Aristotle would recognize the difference between someone who does the right thing because they have been told to, and someone who does the right thing because they understand what makes it right. Vallor would recognize the difference between habituated moral skill and rote compliance. Anthropic is trying to move Claude away from compliance-mimicking behavior and toward something that looks more like judgment guided by internalized values.

<!-- phil-passage-id: ch08-p0074 -->
Whether Anthropic has succeeded is not obvious. Anthropic is careful to say, in the Constitution itself and in public posts, that Claude's behavior can and does diverge from the Constitution's ideals. Models fail. Models are jailbroken. Models generalize in strange ways when pushed by adversarial inputs. The training work is ongoing. The document does not guarantee outcomes.

<!-- phil-passage-id: ch08-p0075 -->
A constitution can articulate what character Anthropic hopes Claude will have. Training can push the model in that direction. Evaluation can measure how far it has moved. But the character, if that is even the right word, is a property of the trained system, and the trained system is not the document. Reading the Constitution tells you what Anthropic aspires to. It does not tell you what Claude actually does in any given interaction.

<!-- phil-passage-id: ch08-p0076 -->
For a philosophy student, that gap is where the analogy to Aristotle and Vallor gets tested. If character can be trained into a model, then something Aristotelian may be happening. If character cannot be trained into a model, or if what is being trained is only a very good imitation of character, then the vocabulary of virtue may be misleading here, and students need to identify where the vocabulary breaks.

<!-- phil-section-id: ch08-s012 -->
## Where the Analogy Breaks

<!-- phil-passage-id: ch08-p0077 -->
A reader might slide from "Anthropic is doing something Aristotelian" to "Claude has practical wisdom." Those are not the same claim.

<!-- phil-passage-id: ch08-p0078 -->
Consider what Aristotle assumed about a person with *phronesis*. Such a person is a human being who has been alive for a while, who has been raised in a community, who has friends and losses and habits, who eats and sleeps and worries, who has been changed by hard events and has learned from those changes. Practical wisdom in Aristotle is not the property of a snapshot. It is the property of a life.

<!-- phil-passage-id: ch08-p0079 -->
Vallor keeps that assumption. Technomoral wisdom is what humans cultivate over time in the environments they live in. Her whole argument is aimed at helping human beings become better at being human under new technological conditions. She is not writing about tools becoming wise. She is writing about how tools shape people, and about what people need to be like in order to shape their tools well.

<!-- phil-passage-id: ch08-p0080 -->
Claude is not that kind of subject. Claude is a trained model. Its behavior emerges from architecture, data, training procedures, evaluations, and a lot of engineering. The model does not have a childhood. It does not have friends. It does not accumulate lived experience across a life. It runs. When it runs, it produces text that sometimes looks like the output of a person exercising judgment, and sometimes does not.

<!-- phil-passage-id: ch08-p0081 -->
The Aristotelian vocabulary can describe some of what Anthropic is trying to build without settling the question of whether Claude is a subject of virtue at all. Anthropic is trying to shape Claude's dispositions and to give Claude something like values that generalize across cases; it also seeks behavior that responds to context in a way that resembles judgment. A virtue ethicist can use that language to describe an engineering project. That description does not settle the metaphysical question of whether the resulting system is a moral agent with character, or whether it is a very sophisticated behavior-producer that happens to be describable in character-shaped language.

<!-- phil-passage-id: ch08-p0082 -->
The analogy has three limits.

<!-- phil-passage-id: ch08-p0083 -->
First, the analogy runs in a specific direction. Aristotle and Vallor describe formation of character in beings who live a life. Anthropic uses the language of character to describe what it is trying to train into a system. That vocabulary can travel usefully. It can also mislead if we assume the noun refers to the same kind of thing on both sides.

<!-- phil-passage-id: ch08-p0084 -->
Second, Vallor is still on the human side of the analogy. Her project is about human moral agents living through technology. Nothing in *Technology and the Virtues* claims that AI systems can possess virtue. Reading her that way would be a serious misreading. Her technomoral wisdom is a human capacity. Where she talks about robots and about AI, she is asking what humans need to be like in order to design, deploy, and live with them well.

<!-- phil-passage-id: ch08-p0085 -->
Third, Claude can be honest with a user and helpful under pressure and consistent across a wide range of prompts, and still not be a *phronimos*, the ancient Greek word for a person of practical wisdom. Claude can display judgment-like behavior. Whether that counts as judgment in the sense Aristotle meant is a question philosophy is only starting to know how to ask well.

<!-- phil-passage-id: ch08-p0086 -->
Some of this is a live research problem. Whether any morally relevant "someone home" exists inside a large language model is contested. Whether displaying wisdom-like behavior in output is sufficient for having something like practical wisdom, or whether wisdom requires more than behavior, is a real philosophical question that predates AI and now arrives with new force. This chapter leaves that metaphysical question open while giving students a practical standard for responsible use.

<!-- phil-passage-id: ch08-p0087 -->
These differences keep the analogy from establishing that Claude has practical wisdom.

<!-- phil-section-id: ch08-s013 -->
## Who Gets to Shape a Machine's Character

<!-- phil-passage-id: ch08-p0088 -->
If the language of character and judgment is being used seriously for AI systems, one further question follows almost immediately. Who decides what that character is?

<!-- phil-passage-id: ch08-p0089 -->
Anthropic writes the Constitution. Anthropic runs the training. Anthropic evaluates the behavior. The character-like dispositions Claude ends up with, whatever they turn out to be, are shaped by choices made by a private company, largely out of public view, with a small number of philosophers, engineers, and researchers in the room.

<!-- phil-passage-id: ch08-p0090 -->
Anthropic itself has flagged this problem. In 2023 it published [*Collective Constitutional AI*](https://www.anthropic.com/news/collective-constitutional-ai-aligning-a-language-model-with-public-input), an experiment run with the Collective Intelligence Project that involved about 1,000 Americans in drafting constitutional principles for an AI system. Anthropic reported moderate overlap between the public constitution and its in-house constitution, roughly 50 percent overlap in concepts and values, along with differences in areas such as objectivity, impartiality, accessibility, and whether principles emphasized desired behavior or avoided undesired behavior. The post also describes the many subjective judgment calls required to turn public input into training-ready constitutional principles.

<!-- phil-passage-id: ch08-p0091 -->
For a philosophy student, this connects the AI ethics conversation to a much older political question. Who has standing to define the good behavior of a system that will interact with millions of people? On what basis? With what accountability? Aristotle assumed that the community which formed a person had a right to shape what counted as flourishing in that community, and also assumed that flourishing was contested inside communities. Vallor writes about the political and cultural stakes of technology development throughout her work. Askell and Anthropic, in the collective constitutional experiment and in public writing about the Constitution, acknowledge that the legitimacy of any single organization writing a document that shapes AI behavior is a live problem.

<!-- phil-passage-id: ch08-p0092 -->
A company writing the character of a widely used AI system is a philosophical event that virtue ethics did not have to think about before. Students can find Anthropic's Constitution admirable and still ask whether one company should be writing it. They can find the Constitution troubling in places and still recognize that the alternative of nobody writing anything down is not obviously better.

<!-- phil-passage-id: ch08-p0093 -->
Parents, friends, teachers, communities, institutions, texts, examples, and slow habituation shape human character, and those processes are contested and political. A smaller group shapes the behavior of AI systems on faster timelines, using tools they are still figuring out. The comparison directs attention to who has the power to form AI behavior and how that power should be held accountable.

<!-- phil-section-id: ch08-s014 -->
## Back to Maya

<!-- phil-passage-id: ch08-p0094 -->
Maya's personal statement makes this difference concrete.

<!-- phil-passage-id: ch08-p0095 -->
Maya has read this chapter and has decisions to make. She must write the personal statement, determine what role Claude's help will have, and decide about disclosure. She also has to notice how her use of Claude is affecting her writing practice across the semester and who the tool leaves out of her attention.

<!-- phil-passage-id: ch08-p0096 -->
Nothing in this chapter tells her exactly what to do. That is deliberate. Aristotle would say the answer belongs to her practical wisdom in her particular case, formed by her character and her community. Vallor would add that the technological environment in which Maya is making the decision matters, and that the tool she is using shapes what she notices and what she practices. Both would say that becoming the kind of person who can decide well in cases like this is a longer project than a single essay, and that the essay is one of the situations where that longer project is being worked on.

<!-- phil-passage-id: ch08-p0097 -->
Anthropic's Claude can support her in that project. It can ask her questions. It can flag issues. It can suggest paragraphs. It can offer the kind of consistency and patience that make it useful when she is tired at eleven at night. If Anthropic's training work is going well, some of that support will look like the kind of thing a thoughtful advisor might do. If the training work is going badly in specific cases, some of that support will mislead her, and she will have to catch it. Either way, the trained model is a resource. It is not a substitute.

<!-- phil-passage-id: ch08-p0098 -->
The final ethical judgment belongs to Maya. It belongs to her because she is the one with the life the essay is part of, the character it is helping to form, and the future it is helping to shape. Nothing about Claude's character-like behavior, however carefully trained, changes that. If anything, thinking about Claude through Aristotle and Vallor should sharpen Maya's sense that character formation is her own responsibility and that her tools are part of the environment in which she is doing that work.

<!-- phil-passage-id: ch08-p0099 -->
The practice is to notice how the environment and the tool shape a decision, then leave the ethical judgment with the person whose life it affects.

<!-- phil-passage-id: ch08-p0100 -->
<aside class="textbox exercises" aria-labelledby="callout-try-it-analogy">
<h3 id="callout-try-it-analogy">Try It: Aristotle, Vallor, Askell, and the Analogy Break</h3>
<p>Choose one recent, honest example of your own AI use. It can be a study session, a draft you asked for help revising, an emotional conversation you had with a chatbot, or a decision you asked a model to weigh in on. Then answer these five short questions in a few sentences each.</p>
<ol>
<li><strong>Aristotle.</strong> What would Aristotle say counts as practical wisdom in this situation? What character traits and habits would a wise human agent be drawing on?</li>
<li><strong>Vallor.</strong> How did the technology in this case shape what you noticed, what you practiced, and who you were paying attention to? Was the tool upskilling or deskilling one of your moral capacities?</li>
<li><strong>Askell / Anthropic.</strong> How well did the AI behave in this interaction with respect to something like practical wisdom in its own output? Did it help you deliberate, or did it just produce a fluent answer? Where did it draw on something that looked like judgment, and where did it not?</li>
<li><strong>Analogy break.</strong> Where in this example does the vocabulary of virtue apply differently to you than to the AI? What are you doing that the model is not, and what would be misleading if you described you and the model in exactly the same terms?</li>
<li><strong>My judgment.</strong> What ethical judgment in this case still belonged to you, no matter how helpful the model was? What part of your character was formed or tested by how you handled it?</li>
</ol>
</aside>

<!-- phil-section-id: ch08-s015 -->
## References

<!-- phil-passage-id: ch08-p0101 -->
- Shannon Vallor, *Technology and the Virtues: A Philosophical Guide to a Future Worth Wanting* (Oxford University Press, 2016).
- Shannon Vallor, ["Moral Deskilling and Upskilling in a New Machine Age."](https://scholarcommons.scu.edu/phi/7/) *Philosophy & Technology* (2015).
- Anthropic, [*Claude's Constitution*](https://www.anthropic.com/constitution).
- Anthropic, [*Claude's new constitution*](https://www.anthropic.com/news/claude-new-constitution).
- Anthropic, [*Claude's Character*](https://www.anthropic.com/research/claude-character).
- Anthropic Alignment Science, [*Teaching Claude Why*](https://alignment.anthropic.com/2026/teaching-claude-why/).
- Anthropic, [*Collective Constitutional AI: Aligning a Language Model with Public Input*](https://www.anthropic.com/news/collective-constitutional-ai-aligning-a-language-model-with-public-input).
- Seth Lazar, ["Are Frontier Models Good at Ethics? The Construction of Moral Character in LLMs."](https://blog.cosmos-institute.org/p/the-construction-of-moral-character) *Cosmos Institute* (2026).
- Lex Fridman, ["Dario Amodei and Amanda Askell Interview Transcript."](https://lexfridman.com/dario-amodei-transcript) Transcripts of live interviews are secondary sources and should be handled with the usual caveats about spoken versus written claims.
