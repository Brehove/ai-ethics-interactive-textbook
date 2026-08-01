# How Generative AI Produces Answers: Prediction, Post-Training, and the Source Trail

<!-- phil-section-id: ch03-s001 -->
## An Answer That Sounds Right

<!-- phil-passage-id: ch03-p0001 -->
A student opens a general AI chatbot and asks, `What is an argument?` The answer arrives within seconds:

<!-- phil-passage-id: ch03-p0002 -->
<aside class="textbox examples textbox--generated-example" aria-labelledby="generated-answer-argument">
<h3 id="generated-answer-argument">Generated Answer: What Is an Argument?</h3>
<p>An argument is a set of statements meant to support a conclusion. It is not just a quarrel or disagreement.</p>
<p>A basic argument has two parts:</p>
<ol>
<li><strong>Premises:</strong> the reasons or evidence offered.</li>
<li><strong>Conclusion:</strong> the claim those reasons are meant to prove or make more believable.</li>
</ol>
<p><strong>Example:</strong></p>
<ul>
<li>All humans are mortal.</li>
<li>Socrates is human.</li>
<li>Therefore, Socrates is mortal.</li>
</ul>
<p>The first two statements are premises. The final statement is the conclusion.</p>
<p>Arguments can be strong or weak depending on how well the premises support the conclusion. They can also be sound or unsound depending on whether the reasoning is valid and the premises are true. In philosophy, logic, and academic writing, an argument is mainly about giving reasons, not winning a fight.</p>
</aside>

<!-- phil-passage-id: ch03-p0003 -->
This is a respectable general answer. It distinguishes an argument from a quarrel, explains premises and conclusions, uses a standard deductive example, and introduces validity and soundness. A student could learn something accurate from it.

<!-- phil-passage-id: ch03-p0004 -->
The answer still falls short of the method used in PHIL 123. This course makes ethical reasoning visible through a normative P1, a descriptive P2, and a case-specific conclusion. The generic response never introduces that distinction. Its polished voice tells us that the system can produce a coherent explanation, but the voice alone cannot tell us whether the explanation fits this course or gives us enough evidence to rely on it.

<!-- phil-section-id: ch03-s002 -->
## How This Chapter Fits the Course

<!-- phil-passage-id: ch03-p0005 -->
AI appears throughout PHIL 123, but its role changes. Before using a chatbot to practice ethical frameworks, map research, or help develop a project, you need a working model of how its answers are produced. This chapter provides that foundation through prediction, post-training, tool wrappers, and source trails. These ideas explain why fluent output may still be inaccurate, incomplete, biased, or poorly fitted to the task. The next chapter turns that understanding into a practical method for evaluating AI contributions and deciding how to use them.

<!-- phil-section-id: ch03-s003 -->
## From AI to the Answer in Front of You

<!-- phil-passage-id: ch03-p0006 -->
The term *artificial intelligence* covers many kinds of computer systems. A spam filter, route planner, image classifier, and language chatbot can all be called AI even though they work differently. *Machine learning* describes approaches that develop patterns from examples. *Generative AI* describes systems that produce new text, images, audio, video, code, or other material from learned patterns. A *large language model*, usually shortened to LLM, is a model family trained especially to process and produce language. Google's [introduction to large language models](https://developers.google.com/machine-learning/crash-course/llm) offers a useful technical starting point.

<!-- phil-passage-id: ch03-p0007 -->
These terms answer different questions. *Machine learning* names an approach to building a system. *Generative AI* names a class of systems defined by the kinds of content they generate. *LLM* names a language-focused model family. The chatbot a student opens is a product that combines one or more models with an interface and other components.

<!-- phil-passage-id: ch03-p0008 -->
Four layers provide a practical map of the answer that appears. They are not four chronological steps. Source grounding, for example, happens inside the runtime product when it retrieves material for a particular request. The map separates kinds of influence that are easy to blur when a single response arrives in a single text box.

<!-- phil-passage-id: ch03-p0009 -->
| Layer | What happens | What it helps explain |
|---|---|---|
| Pretraining | The model learns broad language patterns by predicting tokens across a large collection of data. | Fluency, broad learned associations, and patterned gaps or defaults. |
| Post-training | Later training further shapes the model through examples, preferences, rewards, written principles, or other feedback. | Instruction following, assistant style, refusal patterns, and other learned behaviors. |
| Runtime product | The application combines the model with instructions, conversation history, interface features, and available tools during a request. | Why the same model can behave differently across products or conversations. |
| Source grounding within runtime | The product retrieves webpages, uploaded files, or other external material and places selected content into the model's context. | How an answer can use current or local material and produce a source trail that can be checked. |

<!-- phil-passage-id: ch03-p0010 -->
The opening answer about arguments may reflect all four layers. Pretraining supplies broad patterns associated with definitions, premises, conclusions, and the Socrates example. Post-training helps turn those patterns into a direct and organized teaching response. The runtime product supplies the student's prompt and may add instructions about tone or format. If the product searches or receives the PHIL 123 chapter, source grounding adds that material to the immediate context. Each layer can improve the response. None makes every sentence true or appropriate for the course.

<!-- phil-section-id: ch03-s004 -->
## How the Model Generates Language

<!-- phil-passage-id: ch03-p0011 -->
The pretraining layer needs a closer look because it creates the language model that later layers shape and direct. Text first becomes tokens. A token may be a word, part of a word, punctuation, or another text unit. The divisions vary across models and languages. A rare name, local acronym, or technical term may be split into several pieces. [Subword tokenization](https://aclanthology.org/D18-2012/) is one established way to build a vocabulary from pieces smaller than whole words. Each token receives a numerical representation the model can process.

<!-- phil-passage-id: ch03-p0012 -->
During pretraining, the language models behind many current chatbots work across token sequences and repeatedly practice predicting the next token. Prediction errors guide adjustments to internal numerical settings called weights. Across many examples, those adjustments develop patterns connecting words, genres, factual associations, argument forms, and styles of explanation. [Brown and colleagues' account of GPT-3](https://papers.neurips.cc/paper/2020/hash/1457c0d6bfcb4967418bfb8ac142f64a-Abstract.html) documents one influential example of this training approach. The model is not given a page of propositions already marked true or false. It learns relationships that help it continue language.

<!-- phil-passage-id: ch03-p0013 -->
When the trained model generates a response, it uses its learned weights and the context available for that request. It assigns probability scores to possible next tokens. The product's generation process chooses from those possibilities, adds the resulting token to the sequence, and repeats. Georgetown University's Center for Security and Emerging Technology explains why this operation becomes surprisingly capable at scale in [The Surprising Power of Next Word Prediction](https://cset.georgetown.edu/article/the-surprising-power-of-next-word-prediction-large-language-models-explained-part-1/).

<!-- phil-passage-id: ch03-p0014 -->
After `An argument is`, continuations such as `a set of statements`, `a claim supported by reasons`, or `an attempt to persuade` may all fit. Once the answer uses `premises`, later language about evidence and conclusions becomes more likely. Once it introduces Socrates, the familiar mortality example becomes more likely. Many local choices accumulate into a response that reads as if it had been planned all at once.

<!-- phil-passage-id: ch03-p0015 -->
Phone autocomplete shares the narrow operation of predicting a continuation, but it is a poor complete picture of an LLM. Modern LLMs typically use a transformer design that can draw on relationships across a much larger context. The context may include the current prompt, earlier turns, application instructions, and documents or search results supplied by the product. Google's plain-language page on [transformers and self-attention](https://developers.google.com/machine-learning/crash-course/llm/transformers) explains the basic mechanism, while Vaswani and colleagues' [Attention Is All You Need](https://arxiv.org/abs/1706.03762) provides its original technical lineage.

<!-- phil-passage-id: ch03-p0016 -->
Attention is one part of this context-sensitive generation. When a prompt asks about an argument, it helps the model relate `premises`, `conclusion`, `validity`, and the Socrates example across the available context. A change early in the answer can alter which later continuations fit. A product may also choose among several plausible tokens rather than always taking the highest-scoring one, which is one reason the same prompt can produce different responses. Research on [neural text generation](https://arxiv.org/abs/1904.09751) examines this choice. Runtime instructions, conversation history, retrieved material, model selection, and product updates can introduce other differences.

<!-- phil-passage-id: ch03-p0017 -->
The probabilities involved have a narrower meaning than everyday confidence. A high probability for the next token means that the token fits the learned sequence well. It does not mean that the completed sentence has a high probability of being true. `Socrates` may strongly predict `mortal` in a familiar logic example. A philosopher's name may also strongly predict a quotation-shaped sentence that the philosopher never wrote. Murray Shanahan makes this distinction explicit in [Talking About Large Language Models](https://arxiv.org/abs/2212.03551): probable continuations should not be casually redescribed as a model's knowledge, belief, or intention. The generation process measures fit within a learned pattern. Whether a claim is true depends on what it says and how things are; warranted acceptance requires adequate evidence or argument.

<!-- phil-passage-id: ch03-p0018 -->
This difference separates coherence from evidence. A coherent answer has parts that fit together. Evidence gives support for accepting a claim. The generic answer is coherent because its definitions and example form a recognizable whole. Course fit remains unestablished because the response supplies no source showing that it matches the terminology and method required in PHIL 123. Confident presentation provides no additional fact-check. Warranted trust depends on reasons for relying on the answer in this setting, such as a course source, an inspectable citation, a successful comparison with the assigned definition, or the student's own logical check.

<!-- phil-passage-id: ch03-p0019 -->
<aside class="textbox shaded textbox--key-point" role="note" aria-labelledby="coherence-and-warrant">
<h3 id="coherence-and-warrant">Key Point: Coherence and Warrant</h3>
<p>A response is coherent when its parts fit together. A claim is warranted when evidence or reasoning supports accepting it. Fluent generation can produce coherence before the student has checked the warrant.</p>
</aside>

<!-- phil-passage-id: ch03-p0020 -->
This account does not reduce an LLM to phone autocomplete, and it does not settle whether language models possess forms of representation, competence, grounding, or understanding. Raphaël Millière and Cameron Buckner review several sides of that debate in [A Philosophical Introduction to Language Models](https://arxiv.org/abs/2401.03910). PHIL 123 does not need a final answer to that dispute before evaluating a generated claim. Whatever account of machine understanding proves strongest, the claim still needs enough evidence and course context to support the use a student plans to make of it.

<!-- phil-section-id: ch03-s005 -->
## Pretraining Creates Defaults; Post-Training Shapes an Assistant

<!-- phil-passage-id: ch03-p0021 -->
Pretraining gives a model broad reach. Learned patterns help it produce a sonnet, summarize a memo, explain a fallacy, or continue a line of code. They also provide defaults. If a prompt is brief, many kinds of response could fit. Familiar learned patterns make some definitions, examples, and styles more likely than others. The opening answer follows a common introductory sequence using premises, conclusion, Socrates, validity, and soundness.

<!-- phil-passage-id: ch03-p0022 -->
These defaults carry limitations from the data. Some topics appear frequently and in many forms. Local course methods, recent policy changes, uncommon names, and community-specific knowledge may appear less often. The [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) documents how training data can contain imbalances and latent systemic bias, while generated outputs can reproduce stereotyping or homogenized frames. A response may treat one vocabulary as universal, smooth a real disagreement into generic balance, or supply a familiar frame before considering a course-specific one.

<!-- phil-passage-id: ch03-p0023 -->
A pretrained model is not yet the assistant a student expects to encounter. The base model has learned to continue language. Users expect an assistant to interpret requests, follow instructions, organize an answer, decline some tasks, and maintain a conversational role. Developers shape more of that behavior through post-training.

<!-- phil-passage-id: ch03-p0024 -->
Post-training can include demonstrations of preferred responses, human ratings, preference models, written principles, safety rules, and additional feedback. Ouyang and colleagues documented one influential approach in [Training Language Models to Follow Instructions with Human Feedback](https://arxiv.org/abs/2203.02155). Bai and colleagues described another in [Constitutional AI](https://arxiv.org/abs/2212.08073), where written principles and AI-generated feedback help shape responses. These papers describe particular methods from particular research programs. They support the broader distinction between a pretrained language model and a model further shaped to act as an assistant.

<!-- phil-passage-id: ch03-p0025 -->
That shaping affects the surface students encounter. Instruction training can make a response more direct. Preference feedback can reward organization, relevance, reassurance, or a cooperative conversational style. Safety training can encourage refusal or redirection in selected situations. The exact combination varies across systems and changes over time.

<!-- phil-passage-id: ch03-p0026 -->
The generic argument answer is consistent with that kind of shaping. It answers immediately, organizes the explanation around definitions and an example, and closes with a concise distinction between reasoning and fighting. Its structure fits assistant behavior shaped around the expectation that a good answer will be approachable and useful.

<!-- phil-passage-id: ch03-p0027 -->
The helpful style can also mislead. Students may experience organization as expertise and reassurance as reliability. Complete sentences can conceal uncertainty. Preference shaping can also produce excessive agreement. Sharma and colleagues tested several production assistants and documented patterns of [sycophancy](https://arxiv.org/abs/2310.13548), including matching a user's stated beliefs, giving feedback biased toward the user's view, and changing answers under user pressure. Their findings concern systems tested in 2023 and do not establish a current rate for every chatbot. They do show how satisfying a user can conflict with the resistance careful reasoning sometimes needs.

<!-- phil-passage-id: ch03-p0028 -->
In a classroom, a student may ask whether an argument is strong and receive a polished defense before the assistant tests the starting claim. The response can contain useful ideas while its supportive posture determines which questions appear and which objections disappear. Later in the course, students will learn to direct an AI interlocutor toward premise checks, counterexamples, and serious objections.

<!-- phil-passage-id: ch03-p0029 -->
Post-training can also shape when an assistant refuses, warns, or reframes a request. A refusal tells the user something about the system's learned behavior and governing instructions. It does not settle the ethical question behind the request. Reassurance has the same limitation. The assistant's behavior is part of what a student evaluates; the relevant sources and reasoning still determine what the student should accept as true or right.

<!-- phil-section-id: ch03-s006 -->
## The Tool Around the Model

<!-- phil-passage-id: ch03-p0030 -->
Students rarely interact with a language model in isolation. They use a tool that combines the model with an interface and other components. The tool may add [application instructions](https://developers.openai.com/api/docs/guides/text) that describe the assistant's role. It may include a custom tutor prompt written by an instructor or send uploaded course material with the student's question. Some tools can [retrieve or search](https://learn.microsoft.com/en-us/azure/foundry/concepts/retrieval-augmented-generation) a collection and display citation links. A product may also add conversation history or rules about which resources the model can access.

<!-- phil-passage-id: ch03-p0031 -->
These wrapper features affect the answer even when the underlying model stays the same. OpenAI's [text generation documentation](https://developers.openai.com/api/docs/guides/text) shows how application instructions and user input can occupy different parts of a model request. A PHIL 123 tutor can use that layer to ask students for an argument before offering a repair, distinguish normative P1 from descriptive P2, and avoid writing a final discussion post. Those instructions do not change what the model learned during pretraining. They alter the immediate context and the behavior requested from it.

<!-- phil-passage-id: ch03-p0032 -->
One response can therefore combine several inputs whose roles are easy to blur. Learned model patterns supply much of its language. Interface instructions establish a task or tone. A custom tutor prompt can add course rules, while an uploaded chapter supplies definitions and examples. Search may contribute current material. Conversation history can steer the answer toward assumptions made earlier. When the response fails, identifying the contributing layer helps locate the check. A wrong course definition calls for comparison with the assigned chapter. A stale date calls for a current source. An overly agreeable answer calls for scrutiny of the prompt and assistant behavior.

<!-- phil-passage-id: ch03-p0033 -->
Uploaded material and retrieval add another kind of context. In retrieval-augmented generation, a system searches a collection, selects material that appears relevant, and supplies that material to the language model while it writes. Lewis and colleagues' [Retrieval-Augmented Generation](https://arxiv.org/abs/2005.11401) is part of the technical lineage for this approach. Microsoft's current [overview of retrieval and indexes](https://learn.microsoft.com/en-us/azure/foundry/concepts/retrieval-augmented-generation) gives a product-level explanation of the same broad process.

<!-- phil-passage-id: ch03-p0034 -->
Suppose a tutor receives the PHIL 123 chapter [Testing Moral Arguments: Premises, Inferences, Objections, and Revision](https://cwi.pressbooks.pub/ethicsandai/chapter/testing-moral-arguments/). The response can now draw on the course's P1/P2/C structure, its normative and descriptive premise distinction, and its methods for cross-examination. The added source improves the chance that the answer will fit the course. Retrieval research has also found reductions in some forms of hallucination in studied systems, including the conversational systems examined by Shuster and colleagues in [Retrieval Augmentation Reduces Hallucination in Conversation](https://aclanthology.org/2021.findings-emnlp.320/).

<!-- phil-passage-id: ch03-p0035 -->
A retrieved page still has to be selected, interpreted, and converted into generated prose. The system may retrieve the wrong passage. It may omit a qualification or connect a source to a sentence the source does not support. The student now has concrete material to inspect, yet the source trail still needs a claim-to-source comparison.

<!-- phil-passage-id: ch03-p0036 -->
<aside class="textbox shaded textbox--source-trail" role="note" aria-labelledby="source-trail-inspection">
<h3 id="source-trail-inspection">Source Trail: What Can You Inspect?</h3>
<p>Identify the prompt, the tool's added instructions, any uploaded or retrieved material, and the source attached to the claim. A visible trail makes checking possible. The check asks whether the source supports the exact sentence the model produced.</p>
</aside>

<!-- phil-passage-id: ch03-p0037 -->
Different chatbot experiences can arise from the tool-model distinction. Learned patterns and generation come from the model. The surrounding tool decides which instructions and materials join the immediate context. Students need both pieces before deciding how much weight to place on the answer.

<!-- phil-section-id: ch03-s007 -->
## What the Mechanism Lets You Predict

<!-- phil-passage-id: ch03-p0038 -->
Once we separate prediction, training, post-training, and the wrapper, familiar failures stop looking random.

<!-- phil-passage-id: ch03-p0039 -->
The first is hallucination, also called confabulation in some technical and policy work. A model can produce a plausible continuation when its support for the requested detail is weak. The [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) treats confabulation as a documented generative-AI risk. This risk follows from a system that must generate likely language. Names, quotations, dates, and citations can fit the pattern of a good answer even when the details are wrong.

<!-- phil-passage-id: ch03-p0040 -->
Citation mismatch is a related problem. A model may invent a source. It may give inaccurate details for a real source. It may also attach a real source to a sentence the source cannot support. Walters and Wilder's study of [fabrication and errors in bibliographic citations generated by ChatGPT](https://www.nature.com/articles/s41598-023-41032-5) documents the first two error types in the systems they examined. Retrieval helps with source access, but it does not remove the need to compare the sentence with the source.

<!-- phil-passage-id: ch03-p0041 -->
Genericity is quieter. The original answer follows a common introductory pattern, so it never reaches the particular distinction this course asks students to practice. Inherited framing produces a similar effect. A model may begin from familiar learned patterns, mirror the assumptions in the prompt, or smooth a disciplinary disagreement into a neutral-looking summary. The answer can remain polished while the frame narrows what the student sees.

<!-- phil-passage-id: ch03-p0042 -->
Now compare the first response with a second fixed response generated on July 9, 2026. This time, the model received the PHIL 123 definitions and a request for an example about using AI to write a personal apology. It answered in the course form:

<!-- phil-passage-id: ch03-p0043 -->
<aside class="textbox examples textbox--worked-argument" aria-labelledby="course-grounded-apology-argument">
<h3 id="course-grounded-apology-argument">Course-Grounded Generated Argument</h3>
<p><strong>P1.</strong> If an apology is meant to take personal responsibility, then the person apologizing should express their own understanding of the harm they caused.</p>
<p><strong>P2.</strong> Using AI to write the apology may produce polished words, but those words may not reflect the person's own understanding of the harm.</p>
<p><strong>C.</strong> Therefore, using AI to write a personal apology can be ethically problematic if it replaces the person's own reflection and responsibility.</p>
</aside>

<!-- phil-passage-id: ch03-p0044 -->
The improvement is specific. The response uses P1 for a normative principle, P2 for a descriptive claim about the case, and C for a case-specific conclusion. It now fits the vocabulary and practices of PHIL 123. A student could use it to see how an ethical argument is supposed to be organized.

<!-- phil-passage-id: ch03-p0045 -->
The new answer still needs examination. Its P2 says that AI-written words `may not reflect` the person's understanding. That phrase does not report an observed fact about a particular apology. It could be an empirical prediction about what the writer understands. It could also compress a normative judgment about authenticity or responsibility. Either reading needs support. P2 therefore leaves an unsupported inference or potentially evaluative judgment inside what appears to be a descriptive premise.

<!-- phil-passage-id: ch03-p0046 -->
The conclusion also introduces conditions. It says AI use `can be ethically problematic` *if* the tool replaces reflection and responsibility. That is a more careful claim than a blanket prohibition. The argument now depends on what counts as replacement, how we would know it occurred, and why personal expression is required for this kind of apology. The course source improved the answer's fit. It did not make those judgments for the student.

<!-- phil-passage-id: ch03-p0047 -->
This comparison shows why course specificity is its own quality check. The generally accurate first answer remains under-fitted, while the second improves course fit and leaves contestable claims in place. Both sound confident and cohere internally. The grounded response has a clearer evidential trail because we know which course definitions entered its context. Warranted trust still depends on checking the resulting premises and inference.

<!-- phil-passage-id: ch03-p0048 -->
A source trail can strengthen the reasons for taking an answer seriously because it exposes definitions and evidence for inspection. It cannot make the answer authoritative by itself. Authority still depends on whether the source and reasoning support the claim.

<!-- phil-section-id: ch03-s008 -->
## From Explanation to Judgment

<!-- phil-passage-id: ch03-p0049 -->
A final philosophical distinction clarifies the checking obligation. *Epistemic authority* is a source's standing to be trusted as a guide to knowledge. Philosophers disagree about whether AI-produced reports count as [testimony](https://plato.stanford.edu/entries/epistemology-social/), especially because some accounts require a speaker who can stand behind an assertion. [One recent analysis](https://link.springer.com/article/10.1007/s11023-024-09681-1) argues that predictive success alone does not establish full epistemic authority, though a carefully structured human-AI process may sometimes support it. In PHIL 123, students supply the disciplinary standard, inspect the evidence, and decide whether the reasoning holds.

<!-- phil-passage-id: ch03-p0050 -->
A fluent response gives you evidence about the system's ability to generate an explanation that fits the prompt. It may also give you useful concepts, candidate reasons, or a source trail. Each of those can support further thinking. None of them automatically settles whether a sentence is true, whether a source supports it, or whether the answer follows the method required in PHIL 123.

<!-- phil-passage-id: ch03-p0051 -->
Choose one sentence from an AI explanation that you might study from, repeat, or use in an argument. Identify what kind of check it needs. Factual claims may need external sources. Verify a quotation in the original text and confirm its attribution. Compare a course definition with the assigned chapter. Test a P1/P2/C argument by examining its premises and inference. If the tool displays a source, open it and compare the source with the exact claim.

<!-- phil-passage-id: ch03-p0052 -->
The depth of the check should match the use. For a low-stakes brainstorming suggestion, a quick comparison with the course concept may be enough. Direct source support is needed for a quotation, statistic, or factual premise that carries an argument. Moral conclusions require the student to examine the principle and the inference. Checking one sentence the argument depends on gives you a concrete basis for evaluating the answer.

<!-- phil-passage-id: ch03-p0053 -->
<aside class="textbox exercises" aria-labelledby="try-it-remaining-check">
<h3 id="try-it-remaining-check">Try It: Find the Remaining Check</h3>
<p>Return to the course-grounded apology argument. Identify one claim, source, or course concept that still needs checking. State what evidence or reasoning would let you evaluate it.</p>
</aside>

<!-- phil-passage-id: ch03-p0054 -->
The next chapter treats AI as an interlocutor and develops ways to direct and evaluate that interaction. The distinction learned here carries forward: a better-grounded response can still leave a premise, source, or course concept for you to judge.

<!-- phil-section-id: ch03-s009 -->
## References

<!-- phil-passage-id: ch03-p0055 -->
- Bai, Y., et al. (2022). [Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073). Primary technical source for one documented method of post-training with written principles and AI feedback. This method does not describe every assistant.
- Brown, T. B., et al. (2020). [Language Models Are Few-Shot Learners](https://papers.neurips.cc/paper/2020/hash/1457c0d6bfcb4967418bfb8ac142f64a-Abstract.html). *Advances in Neural Information Processing Systems, 33*. Primary model lineage used as one documented example of large-scale autoregressive pretraining.
- Burtell, M., & Toner, H. (2024). [The Surprising Power of Next Word Prediction: Large Language Models Explained, Part 1](https://cset.georgetown.edu/article/the-surprising-power-of-next-word-prediction-large-language-models-explained-part-1/). Center for Security and Emerging Technology. Used for the student-facing explanation of how next-token prediction develops coherent language at scale.
- Ferrario, A., Facchini, A., & Termine, A. (2024). [Experts or Authorities? The Strange Case of the Presumed Epistemic Superiority of Artificial Intelligence Systems](https://link.springer.com/article/10.1007/s11023-024-09681-1). *Minds and Machines*. Used for the distinction between predictive performance and epistemic expertise or authority. The article defends one position in a live debate.
- Gladd, J. (2026). [Testing Moral Arguments: Premises, Inferences, Objections, and Revision](https://cwi.pressbooks.pub/ethicsandai/chapter/testing-moral-arguments/). *Ethics and Artificial Intelligence*. Used for PHIL 123's P1/P2/C structure, normative and descriptive premise distinction, and cross-examination methods.
- Google. (2026). [Introduction to Large Language Models](https://developers.google.com/machine-learning/crash-course/llm). Last updated January 9, 2026. Used for the introductory account of LLMs, tokens, context, and prediction.
- Google. (2026). [LLMs: What's a Large Language Model?](https://developers.google.com/machine-learning/crash-course/llm/transformers). Last updated January 2, 2026. Used for the plain-language explanation of transformers and self-attention.
- Holtzman, A., Buys, J., Du, L., Forbes, M., & Choi, Y. (2020). [The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751). *International Conference on Learning Representations*. Primary technical source used for sampling and decoding as one source of output variation.
- Kudo, T., & Richardson, J. (2018). [SentencePiece: A Simple and Language Independent Subword Tokenizer and Detokenizer for Neural Text Processing](https://aclanthology.org/D18-2012/). *Proceedings of the 2018 Conference on Empirical Methods in Natural Language Processing: System Demonstrations*. Primary technical lineage for subword tokenization.
- Lewis, P., et al. (2020). [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401). Primary technical lineage for retrieval-supplied source context.
- Millière, R., & Buckner, C. (2024). [A Philosophical Introduction to Language Models - Part I: Continuity With Classic Debates](https://arxiv.org/abs/2401.03910). Used as a guardrail against treating competence, grounding, representation, or understanding as settled by the mechanism alone.
- Microsoft Learn. (2026). [Retrieval Augmented Generation (RAG) and Indexes in Microsoft Foundry](https://learn.microsoft.com/en-us/azure/foundry/concepts/retrieval-augmented-generation). Last updated May 20, 2026. Product documentation used for the category-level explanation of retrieval and source grounding.
- National Institute of Standards and Technology. (2024). [Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf). Used for confabulation, latent systemic bias, stereotyping, and homogenization as documented generative-AI risk categories.
- OpenAI. (n.d.). [Text generation](https://developers.openai.com/api/docs/guides/text). Product documentation used for the distinction between model output and application instructions or context.
- Ouyang, L., et al. (2022). [Training Language Models to Follow Instructions with Human Feedback](https://arxiv.org/abs/2203.02155). Early OpenAI/InstructGPT method lineage for instruction following and preference-based post-training; it does not describe every current assistant.
- Shanahan, M. (2022). [Talking About Large Language Models](https://arxiv.org/abs/2212.03551). Used for the distinction between probable text continuation and claims about model knowledge, belief, or intention.
- Sharma, M., et al. (2023). [Towards Understanding Sycophancy in Language Models](https://arxiv.org/abs/2310.13548). Anthropic-led multi-model behavior study used for user-view matching and excessive agreement. The tested systems date from 2023.
- Shuster, K., Poff, S., Chen, M., Kiela, D., & Weston, J. (2021). [Retrieval Augmentation Reduces Hallucination in Conversation](https://aclanthology.org/2021.findings-emnlp.320/). Used for the bounded claim that retrieval reduced hallucination in the conversational systems studied.
- O'Connor, C., Goldberg, S., & Goldman, A. (2024). [Social Epistemology](https://plato.stanford.edu/entries/epistemology-social/). *Stanford Encyclopedia of Philosophy*. Canonical reference used for the dispute over AI reports, testimony, and responsible assertion.
- Vaswani, A., et al. (2017). [Attention Is All You Need](https://arxiv.org/abs/1706.03762). Primary technical lineage for transformer attention.
- Walters, W. H., & Wilder, E. I. (2023). [Fabrication and Errors in the Bibliographic Citations Generated by ChatGPT](https://www.nature.com/articles/s41598-023-41032-5). *Scientific Reports*. Used for fabricated sources and incorrect citation details in the systems studied.

<!-- phil-section-id: ch03-s010 -->
## Adaptation and Attribution

<!-- phil-passage-id: ch03-p0056 -->
This chapter adapts instructional material from Joel Gladd, [What Generative AI Is: How LLMs Produce Fluent Answers That Still Need Checking](https://cwi.pressbooks.pub/cwi101/chapter/what-generative-ai-is-how-llms-produce-fluent-answers-that-still-need-checking/), chapter 10 of *CWI 101 Pathways*, published by the College of Western Idaho and licensed under a [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

<!-- phil-passage-id: ch03-p0057 -->
The present chapter substantially reorganizes and rewrites that material for PHIL 123. Changes include replacing the CWI pathway case with a philosophy-course argumentation case; sharpening the four-layer account of pretraining, post-training, runtime product context, and source grounding; updating the supporting research; and centering the chapter on coherence, evidence, course fit, and warranted trust. This adapted chapter is licensed under a [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).
