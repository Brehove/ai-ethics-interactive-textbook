# From Data Trails to AI Systems: How Human Activity Becomes Prediction, Automation, and Generation

<!-- phil-passage-id: ch11-p0001 -->
Rosa opens Canvas on her phone during a break at work. She checks the deadline for a philosophy discussion, downloads the reading, and closes the app before the page finishes loading. Later that night she watches part of a lecture video, pauses it when her child wakes up, and finishes the reading from a PDF she saved to her phone. The next morning she opens the quiz twice before submitting it. She turns in the discussion post at 11:47 p.m. Two days later, she ignores an automated reminder because she has already handled the problem in another class. She also has a financial-aid hold she does not fully understand.

<!-- phil-passage-id: ch11-p0002 -->
None of these events is dramatic. None is an AI decision. Each one looks like ordinary college life.

<!-- phil-passage-id: ch11-p0003 -->
But the college and the tools around it may record parts of the week: logins, timestamps, submissions, grades, video views, advising notes, device information, aid status, and messages. Some of Rosa's work is visible to the system. Some of it disappears. Canvas may record the click on a reading, while the hour she spent reading offline stays invisible. A dashboard may see a late submission while missing the work schedule behind it. A risk model may see a pattern of missed activity while missing the cracked phone screen, the bus transfer, the childcare interruption, the financial-aid confusion, and the fact that Rosa is actually doing the reading.

<!-- phil-passage-id: ch11-p0004 -->
This is the beginning of datafication. A week of human activity becomes a record. The record becomes searchable, comparable, and reusable. It may help an instructor notice confusion earlier. It may help an adviser reach out before a student disappears. It may help a college see where students get stuck. It may also create a thin profile of Rosa that follows her into a dashboard, a nudge, a prediction, a generated summary, or a decision she never sees.

<!-- phil-passage-id: ch11-p0005 -->
The ethical question begins before the algorithm. Before we ask whether an AI system is fair, accurate, biased, useful, or harmful, we need to ask how the data path was built. This chapter follows that path from lived activity to trace, record, category, proxy, prediction, generated output, or action.

<!-- phil-passage-id: ch11-p0006 -->
<aside class="textbox shaded" role="note" aria-labelledby="key-point-trace-before-verdict">
<h2 id="key-point-trace-before-verdict">Key Point: Trace Before Verdict</h2>
<p>Do not begin by asking whether the AI system is good or bad. Begin by tracing the data path. Ask what became data, what was left out, what category or label was applied, what proxy stood in for a harder human concern, what prediction or output followed, and who could challenge or correct the result.</p>
</aside>

<!-- phil-section-id: ch11-s001 -->
## The Week And The Record

<!-- phil-passage-id: ch11-p0007 -->
Datafication means turning activity, behavior, relationships, text, images, movements, sounds, bodies, places, or institutional events into data that can be stored, linked, compared, analyzed, predicted from, or used to generate outputs. The word sounds abstract, but the process is familiar. A step count turns movement into a number. A gradebook turns learning into scores. A streaming service turns watching into preference data. A pharmacy coupon turns a medication search into a health-related data point. A navigation app turns a route into location history. A chatbot prompt turns a question into text that may be logged, reviewed, retained, or used under certain product settings.

<!-- phil-passage-id: ch11-p0008 -->
The simplest path looks like this:

<!-- phil-passage-id: ch11-p0009 -->
<aside class="textbox shaded textbox--framework-map" role="note" aria-labelledby="framework-map-data-driven-action">
<h3 id="framework-map-data-driven-action">Framework Map: How Human Activity Becomes a Data-Driven Action</h3>
<dl>
<dt><strong>Activity</strong></dt>
<dd>Something a person does or experiences. <strong>Example:</strong> Rosa reads, clicks, pauses, submits, asks, travels, or studies.</dd>
<dt><strong>Trace</strong></dt>
<dd>A captured sign of that activity. <strong>Example:</strong> A timestamp, click, grade, location ping, upload, or message.</dd>
<dt><strong>Record</strong></dt>
<dd>A stored trace or set of traces organized for later use. <strong>Example:</strong> An LMS activity log, advising note, account profile, or health record.</dd>
<dt><strong>Category</strong></dt>
<dd>A label or bucket that makes the record usable. <strong>Example:</strong> Active, late, eligible, at risk, engaged, relevant, or original.</dd>
<dt><strong>Proxy</strong></dt>
<dd>A measurable stand-in for a harder concern. <strong>Example:</strong> Clicks for engagement, cost for need, or fluency for quality.</dd>
<dt><strong>Output or action</strong></dt>
<dd>What the system does with the record. <strong>Example:</strong> An alert, ranking, recommendation, prediction, price, generated summary, denial, or intervention.</dd>
<dt><strong>Contestability</strong></dt>
<dd>Whether someone can inspect, explain, correct, appeal, or refuse. <strong>Example:</strong> Rosa can ask what the flag means, correct an error, or reach a human adviser.</dd>
</dl>
</aside>

<!-- phil-passage-id: ch11-p0010 -->
A trace is not yet the whole story. A trace is a small captured sign: a click, timestamp, quiz score, location ping, search query, upload, like, pause, purchase, prompt, sensor reading, or note. A record is a stored trace or collection of traces organized so that someone or something can use it later. A record may be accurate and still incomplete. Rosa really did submit at 11:47 p.m. That does not mean the late timestamp explains her academic situation.

<!-- phil-passage-id: ch11-p0011 -->
Datafication is useful. It is one reason modern systems can personalize services, coordinate support, improve search, recommend resources, detect patterns, preserve institutional memory, make inaccessible information easier to find, and operate at scale. A college cannot notice course-level bottlenecks without records. A doctor needs durable traces of a patient's history. A library improves search by learning something about sources, queries, and use. Navigation apps need location and traffic data to suggest faster routes. Large language models depend on large bodies of prior text, images, code, structured data, feedback, and human labeling.

<!-- phil-passage-id: ch11-p0012 -->
Data and algorithms are powerful because they help systems see patterns no individual person could easily see alone. They can make a service more responsive, a process easier to inspect, or a tool more accessible. They can also make people easier to sort, rank, profile, monitor, ignore, or act on at a distance.

<!-- phil-passage-id: ch11-p0013 -->
That double edge is the center of this chapter. Datafication is a capability amplifier. It gives institutions, companies, researchers, governments, and AI systems more ways to see and act. That added capacity can support care, discovery, creativity, accountability, access, and coordination. It can also make bad categories, weak proxies, hidden labor, and unequal power easier to automate.

<!-- phil-passage-id: ch11-p0014 -->
The chapter will keep returning to Rosa's week because it is ordinary. Most AI ethics problems do not start with a movie-style robot or a spectacular scandal. They start with records. They start when some part of a person's life becomes legible to a system.

<!-- phil-section-id: ch11-s002 -->
## Data Is Made

<!-- phil-passage-id: ch11-p0015 -->
It is tempting to talk about data as if it were already sitting in the world, waiting to be collected. That picture is too simple. Data is produced. Someone decides what to record, how to format it, which categories to use, how long to keep it, how to combine it, what counts as an error, who can access it, what later use the record can support, and what the data will not try to represent.

<!-- phil-passage-id: ch11-p0016 -->
Lisa Gitelman's edited collection [*"Raw Data" Is an Oxymoron*](https://mitpress.mit.edu/9780262518284/raw-data-is-an-oxymoron/) is often cited because its title captures the problem. Data may feel raw when it arrives in a spreadsheet or dashboard, but it already passed through choices. A reading log exists because a platform records certain events. A grade exists because an instructor used a particular assignment, rubric, deadline, and submission system. A risk score exists because someone decided which traces should count as evidence of risk.

<!-- phil-passage-id: ch11-p0017 -->
That does not make data fake. It means data has a history.

<!-- phil-passage-id: ch11-p0018 -->
Danah boyd and Kate Crawford make a related point in ["Critical Questions for Big Data"](https://www.tandfonline.com/doi/full/10.1080/1369118X.2012.678878). Large datasets can create new knowledge, but size does not remove assumptions. A huge dataset can still be incomplete, biased, poorly interpreted, or badly matched to the question being asked. In student language, more data is not the same as better judgment.

<!-- phil-passage-id: ch11-p0019 -->
Return to Rosa's week. The record may show that she watched only part of a lecture video. It may not show that she already understood the material, that she watched with a friend, that she downloaded the transcript, or that she read the chapter offline. The record may show a late submission. It may not show that she submitted late because her work shift changed. The trace may be accurate while still leaving out the context needed for judgment.

<!-- phil-passage-id: ch11-p0020 -->
Jose van Dijck's work on [datafication, dataism, and dataveillance](https://ojs.library.queensu.ca/index.php/surveillance-and-society/article/view/datafication) is useful here because she shows how digital platforms encourage people to treat data as a privileged way of knowing. If a thing can be counted, tracked, graphed, or predicted, it begins to look more real than the parts of life that resist measurement. That can help. It can also distort.

<!-- phil-passage-id: ch11-p0021 -->
The translation from lived activity into data often makes hidden patterns visible. A college may discover that students in a course consistently stall at the same assignment. A tutoring center may discover that evening hours are more useful for working students. A public-health system may see a pattern of illness earlier than individual clinics would. A creator may learn which parts of a tutorial confuse viewers. Data can reveal bottlenecks and make institutions answerable for patterns they would otherwise miss.

<!-- phil-passage-id: ch11-p0022 -->
The same translation can flatten a person. A record can preserve one trace while dropping the context that made the trace understandable. A dashboard can help someone notice Rosa and still fail to understand her. Ethical judgment begins with that translation.

<!-- phil-passage-id: ch11-p0023 -->
Data-making also involves labor. Some labor is visible: a researcher designs a survey, a nurse enters a clinical note, a teacher grades an assignment, a clerk updates a file. Some labor is hidden: users produce behavioral traces by using a platform, moderators remove disturbing content, contractors label images, students generate examples, writers make public work, and technicians clean datasets. When a system later treats the dataset as a resource, the people who made it useful can disappear from view.

<!-- phil-passage-id: ch11-p0024 -->
<aside class="textbox shaded" role="note" aria-labelledby="key-point-data-not-world">
<h3 id="key-point-data-not-world">Key Point: Data Is Not The World</h3>
<p>Data is not simply lying around in nature. It is made through choices about what to record, how to label it, what to ignore, how to store it, who can use it, and what action it should support.</p>
</aside>

<!-- phil-section-id: ch11-s003 -->
## Why Institutions Count: A Short Genealogy Of Data Power

<!-- phil-passage-id: ch11-p0025 -->
Rosa's Canvas record belongs to a much older story. Data power began long before AI, computers, databases, or apps. Human societies have used records to count people, goods, taxes, land, births, deaths, crimes, illnesses, debts, religious membership, property, movement, communication, and work. The tools changed. The ethical pattern stayed recognizable: records help institutions coordinate life at scale, and the same records can make people easier to govern, extract from, rank, discipline, or ignore.

<!-- phil-passage-id: ch11-p0026 -->
Ancient states counted because administration requires memory. Census histories often point to Mesopotamia, Egypt, China, Rome, and other early states as places where rulers used counts to manage food, labor, taxes, land, and military obligations. The [UK Office for National Statistics](https://www.ons.gov.uk/census/2011census/howourcensusworks/aboutcensuses/censushistory/censustakingintheancientworld) describes ancient census-taking in connection with provisioning, taxation, and clay-tablet records. The [Population Reference Bureau](https://www.prb.org/resource/milestones-and-moments-in-global-census-history/) notes the often-cited Han Dynasty census of 2 CE, which recorded households and population on a massive scale for its time. The Inca used [quipu](https://www.neh.gov/project/quipus-inca-language-knots), knotted-cord record systems, to encode numerical information in a decimal structure.

<!-- phil-passage-id: ch11-p0027 -->
Those examples should not be forced into a single origin story. They show a recurring administrative move. A count can help distribute grain, plan roads or irrigation, assign labor, levy taxes, recruit soldiers, or organize civic status. The same count can support public goods and strengthen control. Every count carries a theory of what the institution wants to see.

<!-- phil-passage-id: ch11-p0028 -->
Older texts already show unease about counting. The Hebrew Bible includes census scenes where numbering a people is connected with order, military strength, royal power, and divine judgment, including [Numbers 1](https://www.biblegateway.com/passage/?search=Numbers%201&version=NRSVUE), [2 Samuel 24](https://www.biblegateway.com/passage/?search=2%20Samuel%2024&version=NRSVUE), and [1 Chronicles 21](https://www.biblegateway.com/passage/?search=1%20Chronicles%2021&version=NRSVUE). Those stories use moral categories different from modern privacy law, but the concern is familiar enough. Counting people can become an act of care, stewardship, pride, distrust, preparation for war, or political control. The act of counting is never only technical once the count changes what an institution can do.

<!-- phil-passage-id: ch11-p0029 -->
Medieval and early modern recordkeeping moved the same pattern into churches, monasteries, royal offices, courts, estates, and standardized state forms. Parish and church registers recorded baptisms, marriages, deaths, and community membership. A register could preserve family history, support inheritance claims, and make care more durable. It could also make belonging subject to institutional authority. The [Domesday Book](https://www.nationalarchives.gov.uk/education/resources/domesday-book/) of 1086 gives a sharper example of recordkeeping as governance. William the Conqueror's survey recorded land, holders, resources, people, and value across England. The record could settle claims and clarify obligations. It could also make taxation and control more precise.

<!-- phil-passage-id: ch11-p0030 -->
Early modern states added standardization. Forms, tables, maps, ledgers, printed instructions, and regular censuses made people and places comparable across distance. A local description could be translated into a table. A household could be placed inside a category. A town could be compared to another town. Iceland's [1703 census](https://www.unesco.org/en/memory-world/1703-census-iceland) and Sweden's [1749 population tables](https://www.scb.se/en/About-us/main-activity/history-of-statistics-sweden/) are often cited as early European examples of systematic population recordkeeping. The United States built a decennial census into the Constitution beginning in 1790; Britain followed with its first modern census in 1801.

<!-- phil-passage-id: ch11-p0031 -->
James C. Scott's [*Seeing Like a State*](https://politicalscience.yale.edu/publications/seeing-state-how-certain-schemes-improve-human-condition-have-failed) helps explain the ethical tension. States often simplify local life so it can be seen from the center. Standard names, standard measures, cadastral maps, population tables, and official categories make administration possible. They can also flatten local knowledge and make a complicated life easier to act on from far away. Legibility is useful because institutions cannot respond to what they cannot see. It is dangerous when the visible part becomes the whole person.

<!-- phil-passage-id: ch11-p0032 -->
The nineteenth century added faster communication and more durable identification. Telegraphs and telephones moved messages across distance. They also created new possibilities for interception and metadata: who contacted whom, when, from where, and how often. Photography, police files, anthropometry, and fingerprints turned bodies into records that could be stored, searched, and compared. The National Library of Medicine's account of [Bertillon's identification system](https://www.nlm.nih.gov/exhibition/visibleproofs/galleries/technologies/bertillon.html) shows how physical measurements and photographs became standardized identity records. The NIJ [*Fingerprint Sourcebook*](https://www.ojp.gov/pdffiles1/nij/225321.pdf) traces fingerprinting through colonial administration, policing, and forensic identification. Warren and Brandeis's 1890 article on ["The Right to Privacy"](https://louisville.edu/law/library/special-collections/the-louis-d.-brandeis-collection/the-right-to-privacy) responded to a world in which photography and newspapers were making personal life more exposed.

<!-- phil-passage-id: ch11-p0033 -->
Then recordkeeping became machine-readable. Herman Hollerith's punch-card tabulators were used for the 1890 U.S. Census. The Census Bureau explains that [Hollerith's machine](https://www.census.gov/about/history/bureau-history/census-innovations/technology/hollerith-machine.html) read holes in paper cards to tabulate census data, including individual characteristics and cross-tabulations. That shift matters because it turned administrative records into inputs for automated processing. A census form became a card. A card became a signal in a machine. A machine could count combinations faster than clerks could. Later, the Census Bureau's use of [UNIVAC I](https://www.census.gov/about/history/bureau-history/census-innovations/technology/univac-i.html) moved census processing into electronic computing.

<!-- phil-passage-id: ch11-p0034 -->
This is the bridge to modern big data. Digital records are cheap to copy, search, combine, and reuse. Platforms turned ordinary life into streams of observed behavior: searches, clicks, pauses, likes, locations, purchases, uploads, messages, prompts, ratings, and watch histories. Some data is volunteered. Some is observed. Some is inferred. Some is purchased, joined with other records, and sold downstream. The [FTC's 2024 staff report](https://www.ftc.gov/reports/look-behind-screens-examining-data-practices-social-media-video-streaming-services) on social media and video-streaming services makes this platform pattern concrete: selected major services collected, retained, shared, and monetized extensive user data, while safeguards were weak in several areas.

<!-- phil-passage-id: ch11-p0035 -->
Large language models add another layer to the same history. They are built from data trails, but the trails now include cultural material: websites, books, code, images, posts, documentation, public records, licensed corpora, synthetic data, user feedback, and human labeling. The model does not merely store a record in the old sense. It learns patterns from vast collections and can generate new text, code, images, summaries, plans, or classifications. The old recordkeeping question becomes sharper: where did the material come from, what did it leave out, who labored to make it useful, who had authority to reuse it, and what action follows from the generated output?

<!-- phil-passage-id: ch11-p0036 -->
The genealogy matters because it blocks two lazy stories. One says datafication is simply surveillance and should be rejected wherever it appears. That misses the public goods that records can support: representation, health, safety, access, institutional memory, research, accessibility, planning, and care. The other says datafication is neutral because records are only facts. That misses how records are made, categorized, preserved, combined, inferred from, and used by institutions with unequal power.

<!-- phil-passage-id: ch11-p0037 -->
The better habit is to trace the data path. Ask what was counted, what category made it usable, what institution gained capacity, what context was dropped, what later use became possible, and who could inspect or challenge the result. Rosa's Canvas record is new in its medium, but not in its moral structure. A life becomes legible to a system. The system becomes more capable. The question is what that capacity is for, how bounded it is, and whether the people made legible can answer back.

<!-- phil-section-id: ch11-s004 -->
## Categories Make People Legible

<!-- phil-passage-id: ch11-p0038 -->
Institutions need categories. A college needs to know who is enrolled, who has completed a prerequisite, who qualifies for aid, who needs accommodation, who has submitted work, who is graduating, and which courses fill too quickly. Without categories, the institution cannot coordinate services or treat similar cases consistently.

<!-- phil-passage-id: ch11-p0039 -->
Categories can create transparency. If a college tracks pass rates across course formats, it can see whether an online course is creating barriers. If it tracks advising wait times, it can see whether students are being served. If it tracks withdrawal patterns, it can ask whether a policy, schedule, or course design is producing avoidable harm. Data can make institutional patterns visible enough to challenge.

<!-- phil-passage-id: ch11-p0040 -->
The same categories can also misread people. A student marked "inactive" may be reading offline. A student marked "at risk" may be dealing with a temporary work conflict. A student marked "nontraditional" may be treated as an exception even when students like her are common at a community college. A student marked "engaged" may have clicked every page and understood very little.

<!-- phil-passage-id: ch11-p0041 -->
Legibility is the name for this condition: a person, action, place, object, or situation becomes readable to an institution or system. Legibility is useful because institutions cannot respond to what they cannot see. It is dangerous when the institution starts treating the legible part as the whole person.

<!-- phil-passage-id: ch11-p0042 -->
Geoffrey Bowker and Susan Leigh Star's [*Sorting Things Out*](https://mitpress.mit.edu/9780262522953/sorting-things-out/) gives students a way to read categories as infrastructure. Classification systems do not merely describe people and things. They organize work, authority, visibility, memory, and later action. A medical code can coordinate care while forcing a messy condition into a narrow label. A student-success category can help an adviser notice a student while turning a complicated person into a risk profile.

<!-- phil-passage-id: ch11-p0043 -->
Rosa becomes legible through categories: enrolled, active, late, incomplete, aided, on track, at risk, full time, part time, first generation, online, in person. Some categories may help her. Some may harm her. Most are incomplete.

<!-- phil-passage-id: ch11-p0044 -->
Classification also has a memory problem. Once a category enters a record, it can outlive the context that produced it. A missed week can become a pattern. A financial-aid problem can look like academic disengagement. A disability accommodation can become a hidden part of an institutional workflow. A note written by one adviser can shape how another adviser reads the student months later.

<!-- phil-passage-id: ch11-p0045 -->
Accuracy matters, but a perfectly accurate record can still be ethically thin. Rosa did submit at 11:47 p.m. That is true. The question is what the system does with that truth.

<!-- phil-passage-id: ch11-p0046 -->
This is also a dignity problem. A person has dignity not because every detail of their life can be recorded, but because they are more than any record. A category becomes morally dangerous when it becomes the only way a person can appear to an institution. The problem is not only that a label may be false. It is that a person may be forced to appear through a label too thin to carry their situation.

<!-- phil-passage-id: ch11-p0047 -->
It can also be an epistemic-justice problem. Epistemic justice concerns whether people are treated fairly as knowers, interpreters, and explainers of their own lives. If Rosa's data trail is treated as more authoritative than Rosa's explanation, the institution may know something real and still misunderstand her. A system can make a person visible while making that person's own account harder to hear.

<!-- phil-passage-id: ch11-p0048 -->
<aside class="textbox shaded" role="note" aria-labelledby="framework-map-trace-action">
<h3 id="framework-map-trace-action">Framework Map: From Trace To Action</h3>
<p><strong>Trace:</strong> a captured sign of activity, such as a click, timestamp, grade, location ping, search, upload, or message.</p>
<p><strong>Record:</strong> a stored trace or set of traces organized for later use.</p>
<p><strong>Category:</strong> the label or bucket that makes the record usable, such as active, late, eligible, risky, original, or relevant.</p>
<p><strong>Proxy:</strong> a measurable stand-in for a harder human concern, such as learning, need, risk, quality, or trust.</p>
<p><strong>Output/action:</strong> the nudge, recommendation, ranking, price, denial, warning, generated summary, intervention, or automated step that follows.</p>
<p><strong>Contestability:</strong> the affected person's route to inspect, explain, correct, appeal, refuse, or redirect.</p>
</aside>

<!-- phil-section-id: ch11-s005 -->
## When A Signal Becomes A Proxy

<!-- phil-passage-id: ch11-p0049 -->
The central shift is from signal to proxy.

<!-- phil-passage-id: ch11-p0050 -->
A signal is a trace the system treats as evidence. Rosa's login time is a signal. A quiz attempt is a signal. A late submission is a signal. Location pings, source citations, purchases, messages, resume keywords, heart-rate readings, user ratings, prompts, and writing patterns can function the same way in other systems.

<!-- phil-passage-id: ch11-p0051 -->
A proxy is a signal used as a stand-in for something harder to measure. Clicks may stand in for engagement. Course completion may stand in for readiness. Health-care spending may stand in for medical need. Zip code may stand in for risk. Prior salary may stand in for market value. Writing fluency may stand in for quality. Source count may stand in for research depth. User attention may stand in for satisfaction.

<!-- phil-passage-id: ch11-p0052 -->
Proxies are often necessary. Institutions cannot directly measure every complex human concern. An instructor cannot see every minute of student study. A college cannot personally interview every student every day. A doctor needs tests, history, and records. Search engines need signals of relevance. Recommender systems personalize by treating some past behavior as evidence.

<!-- phil-passage-id: ch11-p0053 -->
Proxy discipline begins when we ask how well the stand-in fits the thing we actually care about.

<!-- phil-passage-id: ch11-p0054 -->
A proxy has to be judged in relation to the action it supports. A rough proxy may be acceptable for a low-stakes suggestion and unacceptable for a high-stakes gate. If a streaming service uses past viewing to recommend a movie, the cost of error is usually small. If a college uses a risk score to route advising, a rough proxy needs more care. If an employer uses a hiring model to screen candidates before a human sees them, the proxy carries heavier consequences. If a health system uses cost as a stand-in for need, the proxy can import unequal access to care into the decision.

<!-- phil-passage-id: ch11-p0055 -->
<table class="shaded">
<caption>Ethical burdens at different levels of proxy use</caption>
<thead>
<tr>
<th scope="col">Proxy use</th>
<th scope="col">Example</th>
<th scope="col">Ethical burden</th>
</tr>
</thead>
<tbody>
<tr>
<th scope="row">Low-stakes suggestion</th>
<td>A recommender suggests a movie, playlist, or article</td>
<td>Lower burden, though manipulation and filter bubbles can still matter</td>
</tr>
<tr>
<th scope="row">Supportive intervention</th>
<td>An adviser receives an outreach flag</td>
<td>Moderate burden: use the proxy to ask better questions, not to settle the judgment</td>
</tr>
<tr>
<th scope="row">High-stakes gate</th>
<td>A model screens applicants, aid eligibility, health priority, or discipline</td>
<td>High burden: stronger evidence, explanation, oversight, and appeal are needed</td>
</tr>
<tr>
<th scope="row">Field-shaping infrastructure</th>
<td>A platform ranking, training dataset, or risk model becomes normal across a field</td>
<td>Very high burden: the proxy may reshape what people make, learn, see, or become</td>
</tr>
</tbody>
</table>

<!-- phil-passage-id: ch11-p0056 -->
Narayanan and Kapoor's [*AI Snake Oil*](https://www.aisnakeoil.com/) is useful for this point because they warn against treating prediction as understanding. A system may predict something useful from available signals while still failing to capture the thing people care about. Predicting who will click is different from knowing what helped someone learn. Predicting who is likely to miss class is different from knowing who needs support. Predicting which applicant resembles past hires is different from knowing who would flourish in the job.

<!-- phil-passage-id: ch11-p0057 -->
Run the proxy question through Rosa's week.

<!-- phil-passage-id: ch11-p0058 -->
Suppose Rosa's course has an early-alert dashboard. The dashboard combines login frequency, video views, due dates, quiz attempts, and late work. It produces a flag: "possible disengagement." The flag could be helpful. It may prompt an adviser to send a friendly message before Rosa falls too far behind. It may help the instructor see that several students got stuck at the same point. Used that way, the proxy is a tool for attention.

<!-- phil-passage-id: ch11-p0059 -->
The same flag can become morally weak very quickly. Rosa may have read offline, watched with captions downloaded earlier, or worked from a borrowed phone. Another student with the same activity pattern may be lost, exhausted, or ready to withdraw. The signal is identical. The human situation is different. A good system would treat the proxy as a reason to ask better questions. A bad system would treat it as a settled judgment.

<!-- phil-passage-id: ch11-p0060 -->
Login frequency may be a useful signal. If Rosa has not logged in for two weeks, an adviser may have reason to check in. The signal could support care. A system that treats fewer logins as lower motivation may misread offline work, phone access, work schedules, or confidence. Late work may also stand in for confusion, fatigue, caregiving, illness, transportation, anxiety, overwork, weak planning, or a badly designed assignment sequence.

<!-- phil-passage-id: ch11-p0061 -->
The same proxy can be useful in one context and reckless in another. A late submission may justify a friendly reminder. It should not automatically justify a judgment about character. A reading click may help an instructor identify a confusing page. It should not automatically become a measure of learning. A risk label may help a college offer support. It should not quietly become a lowered expectation.

<!-- phil-passage-id: ch11-p0062 -->
<aside class="textbox shaded" role="note" aria-labelledby="caution-proxy-useful-weak">
<h3 id="caution-proxy-useful-weak">Caution: A Proxy Can Be Useful And Weak</h3>
<p>A proxy can help a system scale attention, personalize support, or reveal a pattern. That does not make it strong enough for every decision. Ask whether the proxy fits the action, the stakes, the likely errors, and the affected person's ability to challenge or correct the record.</p>
</aside>

<!-- phil-passage-id: ch11-p0063 -->
This section sets up later chapters. Chapter 102 will ask what happens when proxies become opportunity gates. Chapter 315 will ask what happens when proxies steer delegated action. Chapter 319 will ask what happens when prior human work becomes training material for new outputs. Each question starts here, with the discipline of asking what the system is treating as evidence.

<!-- phil-section-id: ch11-s006 -->
## When Data Travels

<!-- phil-passage-id: ch11-p0064 -->
Data becomes more ethically complicated when it moves.

<!-- phil-passage-id: ch11-p0065 -->
A piece of information may make sense in one context and become troubling in another. A student tells an instructor about a family emergency. A patient searches for medication discounts. A person visits a place of worship. A teenager watches mental-health videos. A creator posts an image online. A programmer shares code in a public repository. A student asks a chatbot a personal question. The trace may have one meaning in the setting where it was produced and another meaning when it is aggregated, sold, scraped, used for training, or joined to other records.

<!-- phil-passage-id: ch11-p0066 -->
Helen Nissenbaum's theory of [contextual integrity](https://digitalcommons.law.uw.edu/wlr/vol79/iss1/10/) gives students a useful way to think about this. Privacy is not only secrecy. Social life depends on information flow. Teachers need some student information. Doctors need patient information. Employers need payroll information. Friends share stories. Families coordinate schedules. A violation can occur when information flows in a way that breaks the expectations and purposes of the original context.

<!-- phil-passage-id: ch11-p0067 -->
"Public" is not a magic word. A post on a public forum may be visible, while its later use for model training, profiling, health inference, or ad targeting still requires judgment. A location ping may look harmless by itself, while a pattern of location pings can reveal sensitive routines. A student record may be legitimate for advising and illegitimate for unrelated vendor profiling. A health-app interaction may be useful for the service and troubling when it flows into advertising.

<!-- phil-passage-id: ch11-p0068 -->
Regulators have been wrestling with these problems. The Federal Trade Commission's 2024 report, [*A Look Behind the Screens*](https://www.ftc.gov/reports/look-behind-screens-examining-data-practices-social-media-video-streaming-services), describes large-scale data practices among social media and video streaming services. FTC action involving [Gravy Analytics and Venntel](https://www.ftc.gov/legal-library/browse/cases-proceedings/212-3035-gravy-analytics-inc-matter) shows why location traces can become sensitive when they reveal visits to places such as medical facilities, religious sites, schools, or military locations. The FTC case timeline includes a January 2025 Final Consent Order and a press release announcing that the agency finalized an order prohibiting Gravy Analytics and Venntel from selling sensitive location data. The exact legal rules will continue to change, but the ethical pattern is stable enough for this course: data can change meaning when it travels.

<!-- phil-passage-id: ch11-p0069 -->
Data travel is not always bad. Portability can be a good thing. A student should not have to repeat the same information to every office. A medical record can help clinicians avoid mistakes. A transcript can help a transfer institution understand prior learning. Content provenance can help audiences see where an image came from. A shared dashboard can help a team coordinate support.

<!-- phil-passage-id: ch11-p0070 -->
Judge the movement by context, purpose, limits, and the people affected.

<!-- phil-section-id: ch11-s007 -->
### A Second Data Path: A Pharmacy Coupon App

<!-- phil-passage-id: ch11-p0071 -->
Imagine someone searches for a discount on a medication through a coupon app. In the original context, the person may be trying to save money on health care. The data path may look helpful: a search becomes a coupon, the coupon lowers a price, and the person gets access to treatment.

<!-- phil-passage-id: ch11-p0072 -->
Now trace what else may happen. The medication search can become a health-related trace. That trace may be linked to device identifiers, location, purchase behavior, or advertising categories. A company may infer a condition, a vulnerability, a likely future purchase, or a household pattern. The person may not expect the same information that helped them find a discount to travel into profiling, targeted advertising, brokerage, insurance inference, or employer wellness scoring.

<!-- phil-passage-id: ch11-p0073 -->
The coupon example does not make coupon apps automatically wrong. It shows why context matters: a trace created for one practical purpose can become ethically different when it travels into another system with different incentives, different viewers, and different consequences.

<!-- phil-section-id: ch11-s008 -->
## From Records To Output Or Action

<!-- phil-passage-id: ch11-p0074 -->
Records can sit quietly in a file. They can also become action.

<!-- phil-passage-id: ch11-p0075 -->
Once data is stored and made comparable, systems can use it to classify, predict, rank, recommend, route, generate, and automate. A student's data trail can support an advising alert. A platform profile can support recommendations or ads. A health record can support triage. A hiring system can rank applicants. A financial profile can influence offers. A large training set can help an AI model generate text, code, images, and analysis.

<!-- phil-passage-id: ch11-p0076 -->
It helps to distinguish three downstream uses.

<!-- phil-passage-id: ch11-p0077 -->
A **prediction** estimates something about a person, situation, or future event. It may estimate dropout risk, disease risk, likelihood of repayment, probability of clicking, likelihood of fraud, or chance that a source is relevant.

<!-- phil-passage-id: ch11-p0078 -->
A **generated output** produces new text, image, audio, code, summary, label, recommendation, explanation, or classification from learned patterns. It may produce a draft email, an image, a research summary, a code suggestion, a chatbot answer, a tutoring hint, or a score explanation.

<!-- phil-passage-id: ch11-p0079 -->
An **action** changes what happens next. It may send a reminder, route a patient, rank a resume, flag a transaction, change a price, withhold an offer, recommend a video, notify an adviser, generate a warning, or trigger a human review.

<!-- phil-passage-id: ch11-p0080 -->
At this point, datafication becomes a technology of capacity. It can personalize feedback, adapt services, detect anomalies, reveal patterns, audit institutional processes, and coordinate action across people and tools. A college may use records to find students who need help earlier than an instructor could alone. A workplace may use logs to improve safety. A scientist may use data to discover a pattern no human observer could find unaided. A public agency may use records to allocate resources more accurately.

<!-- phil-passage-id: ch11-p0081 -->
The same path can become a gate. A gate is any decision point that shapes access to attention, help, credit, opportunity, care, credibility, visibility, or second chances. A risk score can move a student into support or stigma. A ranking can move a resume to the top or bottom of a list. A price model can alter what someone is offered. A recommendation system can decide what a creator's audience sees. A generated summary can shape what a reader believes about a source.

<!-- phil-passage-id: ch11-p0082 -->
This is why the data path matters before the ethical verdict. If the records are thin, the categories are crude, the proxy is weak, and the action is high-stakes, the system deserves more scrutiny. If the records are limited, the purpose is clear, the proxy is modest, the action is supportive, and the affected person can challenge the result, the same kind of datafication may be easier to defend.

<!-- phil-passage-id: ch11-p0083 -->
The chapters that follow will slow down at different points along this path. Chapter 102 asks how data-driven gates become biased or unjust. Chapter 315 asks what happens when systems delegate action to automated loops, agents, robots, and dashboards. Chapter 319 asks how cultural and creative work becomes training material for generated outputs.

<!-- phil-passage-id: ch11-p0084 -->
Chapter 91 gives the first move. Do not start with the final output. Start with the path.

<!-- phil-section-id: ch11-s009 -->
## Cultural Work Can Become Data

<!-- phil-passage-id: ch11-p0085 -->
Datafication is often described as a privacy issue because many examples involve personal information: location, browsing, purchases, grades, health, messages, and biometrics. That is only part of the story. Datafication also reaches cultural and creative work.

<!-- phil-passage-id: ch11-p0086 -->
Books, images, songs, code, scientific records, forum posts, captions, product reviews, videos, prompts, and ordinary web pages can become training material. This is one reason generative AI systems can translate, summarize, code, answer questions, generate images, and assist research. They are built from large collections of prior human expression and structured feedback.

<!-- phil-passage-id: ch11-p0087 -->
That capability is real. A model that can translate quickly can widen access. A model that can summarize a technical report can help a beginner enter a field. A model that can generate code examples can help a student practice. A model trained on scientific data can help researchers notice patterns. A model that can produce alt text, captions, drafts, and examples can make creative and academic work more accessible.

<!-- phil-passage-id: ch11-p0088 -->
The ethical questions remain. Who created the material? Was it licensed, scraped, purchased, contributed, or generated synthetically? Was the material public in a way that makes this use appropriate? Did creators, users, or communities have any way to refuse? Who cleaned, labeled, moderated, or rated the data? What kinds of work were excluded? What kinds of work were overrepresented? What field-level effects follow when generated outputs compete with or reshape the work that trained the system?

<!-- phil-passage-id: ch11-p0089 -->
The U.S. Copyright Office's 2025 [AI initiative page](https://www.copyright.gov/ai/) says that Part 3 of its copyright-and-AI report, [*Generative AI Training*](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-3-Generative-AI-Training-Report-Pre-Publication-Version.pdf), remains a pre-publication version, with final publication expected in the future and no substantive changes expected in the analysis or conclusions. This chapter does not need to decide the legal question. Students should separate several questions that often get blurred together: whether a work was publicly available, whether it was legally usable, whether its use was ethically appropriate, whether the model output is copyrightable, whether creators were harmed, and whether the field gained something valuable.

<!-- phil-passage-id: ch11-p0090 -->
Provenance helps, but it does not settle the moral question. Provenance means the record of where something came from and how it changed. Standards such as [C2PA Content Credentials](https://c2pa.org/) try to preserve information about the origin and history of digital media. The National Institute of Standards and Technology's report on [synthetic content transparency](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-4.pdf) treats provenance, watermarking, metadata, and labeling as partial tools for understanding origin and history, while also emphasizing that these tools vary in robustness and require people and institutions to use them well. Those tools can help. They do not prove that a use was fair, accurate, respectful, legal, or trustworthy.

<!-- phil-passage-id: ch11-p0091 -->
<aside class="textbox shaded" role="note" aria-labelledby="caution-public-availability">
<h3 id="caution-public-availability">Caution: Public Availability Is Not Permission</h3>
<p>A public post, image, code file, article, or dataset may be technically available. Its later use still has to be judged for law, ethics, license, context, labor, and fit with model training. Public access, consent, copyright, labor, and context are different questions.</p>
</aside>

<!-- phil-passage-id: ch11-p0092 -->
Rosa's Canvas record and a writer's public essay look very different. They still share one question: what path did the data take before it became useful to a system?

<!-- phil-section-id: ch11-s010 -->
## What Makes Datafication Useful And More Defensible?

<!-- phil-passage-id: ch11-p0093 -->
At this point, a fair objection should be on the table. If data can help colleges support students, doctors catch problems, researchers discover patterns, public agencies allocate resources, platforms improve access, and creators build new tools, why treat datafication as ethically serious?

<!-- phil-passage-id: ch11-p0094 -->
The answer is that usefulness raises the stakes. A system that does nothing useful is easy to reject. The harder systems are useful enough to adopt and powerful enough to harm.

<!-- phil-passage-id: ch11-p0095 -->
Several ethical stakes now come into view.

<!-- phil-passage-id: ch11-p0096 -->
The first stake is **knowledge**. A data system offers a way of knowing a situation, but every way of knowing has limits. Rosa's data trail may reveal a pattern her instructor would miss. It may also hide the reason for the pattern. That is an epistemic problem, meaning a problem about what counts as knowledge. A system can know something real and still know it too thinly for the decision being made. An epistemic injustice occurs when a system makes it harder for someone to be understood, believed, or interpreted fairly.

<!-- phil-passage-id: ch11-p0097 -->
The second stake is **power**. Datafication changes who can see, classify, compare, and act. A student may not know which traces are being collected or how a dashboard reads them. A platform may know more about a user's habits than the user can see in return. A company may turn millions of creative works into training material while individual creators struggle to discover whether their work was included. The ethical question is not only whether the record is accurate. It is also who gains practical power from the record.

<!-- phil-passage-id: ch11-p0098 -->
The third stake is **agency**. People need room to explain, correct, refuse, or redirect how records are used. If Rosa receives a support message because the system noticed a risk pattern, the data trail may serve her agency. If the same pattern quietly lowers expectations or sends her into an opaque category she cannot challenge, it works against her agency. Contestability matters because human beings are not only data subjects. They are people trying to act within systems that increasingly act on them.

<!-- phil-passage-id: ch11-p0099 -->
The fourth stake is **justice**. Data-driven systems distribute attention, opportunity, cost, suspicion, and help. A weak proxy can make the wrong students visible, leave others unsupported, or turn a past pattern into a future barrier. A useful data system can also reveal an inequity that an institution was ignoring. Justice asks who gets helped by the data path, who absorbs the errors, who is missing from the data, and who has enough standing to question the result.

<!-- phil-passage-id: ch11-p0100 -->
The fifth stake is **care**. Many data systems are adopted because institutions want to help people earlier or more consistently. That can be a real good. A warning sign can help a nurse notice deterioration, an adviser notice financial-aid trouble, or a social-service office notice an unmet need. But care depends on attention to context. A care system becomes colder when it replaces listening with labels, treats a proxy as a diagnosis, or makes the most vulnerable people responsible for correcting records they cannot even see.

<!-- phil-passage-id: ch11-p0101 -->
Datafication is more defensible when the purpose is clear. If a college collects activity data to help instructors identify confusing parts of a course, that purpose is easier to evaluate than a vague claim about "improving student success" with no limits. Datafication is more defensible when the data collected is proportionate to that purpose. A reminder system may need deadlines and submission status. It probably does not need every unrelated student trace a vendor can collect.

<!-- phil-passage-id: ch11-p0102 -->
It is more defensible when the data path respects context. Advising data should not silently become advertising data. Health-related searches should not casually become marketing profiles. A public forum post should not be treated as if every future use is equally expected. Context allows information to move while keeping the original relationship and purpose ethically visible.

<!-- phil-passage-id: ch11-p0103 -->
It is more defensible when the proxy is disciplined. A login can be a signal for outreach. It should not become a full judgment about motivation. A grade can be a signal for mastery. It should not become the whole story of a student's ability. A model's fluency can be a signal that the answer is readable. It should not become proof that the answer is true.

<!-- phil-passage-id: ch11-p0104 -->
It is more defensible when the affected person has some route to correction or appeal. Contestability matters because data systems make mistakes and because accurate records can still be misleading. Rosa should have some way to explain why the late work happened, correct a wrong record, ask what a label means, or challenge a decision that affects her path.

<!-- phil-passage-id: ch11-p0105 -->
It is more defensible when the benefits and burdens are visible. A practical review should ask who benefits, who bears the costs, whose circumstances are overlooked, and whether affected people can intervene. Linnet Taylor's article on [data justice](https://journals.sagepub.com/doi/pdf/10.1177/2053951717736335) connects datafication to how people are made visible, represented, and treated.

<!-- phil-passage-id: ch11-p0106 -->
These questions do not require students to reject data-driven systems. They require students to judge them at the right level. The issue is rarely one data point by itself. The issue is the path from trace to record to category to proxy to output or action.

<!-- phil-passage-id: ch11-p0107 -->
<aside class="textbox shaded" role="note" aria-labelledby="defensible-data-path">
<h3 id="defensible-data-path">Defensible Data Path</h3>
<p>A data path is more defensible when it has a clear purpose, a proportionate record, a context-respecting flow, a disciplined proxy, visible benefits and burdens, and a realistic route for correction or appeal.</p>
</aside>

<!-- phil-section-id: ch11-s011 -->
## A Short Practice: Trace One Data Path

<!-- phil-passage-id: ch11-p0108 -->
Choose one data-driven system you use or might encounter in your field. It could be a learning platform, a fitness app, a hiring screen, a recommendation system, a health portal, a navigation app, a chatbot, a plagiarism detector, a scheduling system, a customer-service tool, or a generative AI model.

<!-- phil-passage-id: ch11-p0109 -->
Write a short data-path note. Keep it concrete:

<!-- phil-passage-id: ch11-p0110 -->
1. What human activity, work, text, image, movement, body, place, or event became data?
2. What trace was captured?
3. What was omitted or simplified?
4. What record, profile, dataset, or log stored the trace?
5. Who made the categories?
6. What useful capability did the data make possible?
7. What signal became a proxy?
8. What prediction, ranking, recommendation, generated output, or action followed?
9. Who benefited?
10. Who was affected or missing?
11. Who could inspect, explain, correct, appeal, or refuse?

<!-- phil-passage-id: ch11-p0111 -->
<aside class="textbox exercises" aria-labelledby="try-it-one-data-path">
<h3 id="try-it-one-data-path">Try It: One Data Path</h3>
<p>Do not begin by saying the system is good or bad. Begin with the path. One strong sentence can do a lot: "This system turns ____ into data, uses ____ as a proxy for ____, and then supports ____." After that, your ethical judgment will be sharper.</p>
</aside>

<!-- phil-passage-id: ch11-p0112 -->
If you use Rosa's case, the note might begin like this:

<!-- phil-passage-id: ch11-p0113 -->
The system turns logins, clicks, video views, quiz attempts, submissions, grades, advising notes, and aid status into a student data trail. It may use timestamps and activity patterns as proxies for engagement or risk. That can support early outreach, but it may miss offline reading, work schedules, caregiving, and financial-aid confusion. The data path is more defensible if the result is supportive, limited, explainable, and correctable.

<!-- phil-passage-id: ch11-p0114 -->
Here is a non-school example:

<!-- phil-passage-id: ch11-p0115 -->
A fitness app turns steps, heart rate, sleep timing, workout logs, and location into a health data trail. It may use movement patterns as a proxy for wellness, effort, or risk. That can support reminders, coaching, personal insight, or medical conversation. It becomes less defensible if the data travels into advertising, insurance inference, employer wellness scoring, or opaque profiling without correction, refusal, or clear limits.

<!-- phil-passage-id: ch11-p0116 -->
This kind of tracing does not settle the case. It gives students a better starting point for judgment.

<!-- phil-passage-id: ch11-p0117 -->
The goal is disciplined trust. A data system can help people see what they would otherwise miss. It can also make the wrong thing easier to act on. Ethical data systems should make people, institutions, and decisions visible to one another in ways that can be questioned.

<!-- phil-section-id: ch11-s012 -->
## What To Keep

<!-- phil-passage-id: ch11-p0118 -->
Trace before verdict. Before deciding that an AI system is fair, biased, helpful, or dangerous, ask how the data path was built.

<!-- phil-passage-id: ch11-p0119 -->
Datafication is useful because it makes patterns visible and lets systems coordinate action at scale. That usefulness is exactly why it needs ethical judgment.

<!-- phil-passage-id: ch11-p0120 -->
Data is made. It is shaped by recording choices, categories, formats, labor, storage, access, and purpose.

<!-- phil-passage-id: ch11-p0121 -->
A record is not the whole person, even when the record is accurate. It preserves some traces and drops others.

<!-- phil-passage-id: ch11-p0122 -->
A category makes someone or something legible. Legibility can support care and coordination. It can also flatten context and strengthen control.

<!-- phil-passage-id: ch11-p0123 -->
A proxy is a claim about fit. It may be strong enough for a reminder and too weak for a high-stakes decision.

<!-- phil-passage-id: ch11-p0124 -->
Data changes meaning when it travels. Context, purpose, and limits matter.

<!-- phil-passage-id: ch11-p0125 -->
Public availability is not permission. Cultural work can become training data, but legality, ethics, consent, labor, and context are different questions.

<!-- phil-passage-id: ch11-p0126 -->
A defensible data path has a clear purpose, a proportionate record, a context-respecting flow, a disciplined proxy, visible benefits and burdens, and some route for correction or appeal.

<!-- phil-section-id: ch11-s013 -->
## References

<!-- phil-passage-id: ch11-p0127 -->
- Bible Gateway / NRSVUE. [Numbers 1](https://www.biblegateway.com/passage/?search=Numbers%201&version=NRSVUE), [2 Samuel 24](https://www.biblegateway.com/passage/?search=2%20Samuel%2024&version=NRSVUE), and [1 Chronicles 21](https://www.biblegateway.com/passage/?search=1%20Chronicles%2021&version=NRSVUE). Used as primary-text examples of ancient census scenes and moral unease about counting.
- Bowker, G. C., & Star, S. L. (1999/2000). [*Sorting Things Out: Classification and Its Consequences*](https://mitpress.mit.edu/9780262522953/sorting-things-out/). Used for classification systems, categories, and institutional legibility.
- boyd, d., & Crawford, K. (2012). ["Critical Questions for Big Data"](https://www.tandfonline.com/doi/full/10.1080/1369118X.2012.678878). Used for caution about big-data mythology and the need to interrogate assumptions and bias.
- Coalition for Content Provenance and Authenticity. [C2PA](https://c2pa.org/). Used for content provenance and Content Credentials as partial origin/history infrastructure.
- Federal Trade Commission. (2024). [*A Look Behind the Screens: Examining the Data Practices of Social Media and Video Streaming Services*](https://www.ftc.gov/reports/look-behind-screens-examining-data-practices-social-media-video-streaming-services). Used for platform data trails and large-scale data practices.
- Federal Trade Commission. (2024/2025). [*Gravy Analytics, Inc., In the Matter of*](https://www.ftc.gov/legal-library/browse/cases-proceedings/212-3035-gravy-analytics-inc-matter). Used as a current official example of sensitive location-data enforcement involving Gravy Analytics and Venntel.
- Gitelman, L., ed. (2013). [*"Raw Data" Is an Oxymoron*](https://mitpress.mit.edu/9780262518284/raw-data-is-an-oxymoron/). Used for the premise that data are generated, interpreted, and culturally situated.
- National Archives (UK). [Domesday Book](https://www.nationalarchives.gov.uk/education/resources/domesday-book/). Used for the medieval recordkeeping example of land, property, people, and value.
- National Endowment for the Humanities. [Quipus, The Inca Language of Knots](https://www.neh.gov/project/quipus-inca-language-knots). Used for the ancient-recordkeeping example of Inca quipu and decimal numerical encoding.
- National Institute of Justice. (2011). [*The Fingerprint Sourcebook*](https://www.ojp.gov/pdffiles1/nij/225321.pdf). Used for the history of fingerprinting and biometric identification systems.
- National Institute of Standards and Technology. (2024). [*Reducing Risks Posed by Synthetic Content: An Overview of Technical Approaches to Digital Content Transparency*](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-4.pdf). Used for provenance, watermarking, labeling, and synthetic-content transparency limits.
- National Library of Medicine. [The Bertillon System](https://www.nlm.nih.gov/exhibition/visibleproofs/galleries/technologies/bertillon.html). Used for standardized anthropometric and photographic identification records.
- Narayanan, A., & Kapoor, S. (2024). [*AI Snake Oil*](https://www.aisnakeoil.com/). Used for proxy-measure cautions and prediction-versus-understanding framing.
- Nissenbaum, H. (2004). ["Privacy as Contextual Integrity"](https://digitalcommons.law.uw.edu/wlr/vol79/iss1/10/). Used for contextual integrity and appropriate information flow.
- Population Reference Bureau. (2022). [Milestones and Moments in Global Census History](https://www.prb.org/resource/milestones-and-moments-in-global-census-history/). Used for the ancient census example involving the Han Dynasty census.
- Scott, J. C. (1998). [*Seeing Like a State: How Certain Schemes to Improve the Human Condition Have Failed*](https://politicalscience.yale.edu/publications/seeing-state-how-certain-schemes-improve-human-condition-have-failed). Used for the legibility concept and the risks of administrative simplification.
- Statistics Sweden. [History of Statistics Sweden](https://www.scb.se/en/About-us/main-activity/history-of-statistics-sweden/). Used for the early modern population-table example.
- Taylor, L. (2017). ["What is data justice? The case for connecting digital rights and freedoms globally"](https://journals.sagepub.com/doi/pdf/10.1177/2053951717736335). Used for data justice and how people are made visible, represented, and treated through data.
- UK Office for National Statistics. [Census-taking in the ancient world](https://www.ons.gov.uk/census/2011census/howourcensusworks/aboutcensuses/censushistory/censustakingintheancientworld). Used for ancient census examples and the administrative purposes of early counts.
- UNESCO Memory of the World. [1703 Census of Iceland](https://www.unesco.org/en/memory-world/1703-census-iceland). Used as an early modern population-record example.
- U.S. Census Bureau. [The Hollerith Machine](https://www.census.gov/about/history/bureau-history/census-innovations/technology/hollerith-machine.html). Used for the 1890 census, punch-card tabulation, and early machine-readable administrative records.
- U.S. Census Bureau. [UNIVAC I](https://www.census.gov/about/history/bureau-history/census-innovations/technology/univac-i.html). Used for the shift from punch-card tabulation into electronic census computing.
- U.S. Copyright Office. (2025). [Copyright and Artificial Intelligence](https://www.copyright.gov/ai/) and [*Copyright and Artificial Intelligence, Part 3: Generative AI Training*](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-3-Generative-AI-Training-Report-Pre-Publication-Version.pdf). Used for the training-data bridge and the unsettled, fact-specific nature of generative AI training questions.
- van Dijck, J. (2014). ["Datafication, dataism and dataveillance"](https://ojs.library.queensu.ca/index.php/surveillance-and-society/article/view/datafication). Used for datafication vocabulary and caution about treating datafication as a superior way of knowing.
- Warren, S. D., & Brandeis, L. D. (1890). ["The Right to Privacy"](https://louisville.edu/law/library/special-collections/the-louis-d.-brandeis-collection/the-right-to-privacy). Used for the nineteenth-century privacy response to photography and press publicity.
