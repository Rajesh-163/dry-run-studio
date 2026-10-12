# Dry Run Studio

Paste a LeetCode link or your own solution and watch it run, step by step, on a whiteboard:
arrays with sliding pointers, hash maps, stacks, queues, linked lists, trees, grids and graphs.

## Run it

You need [Node.js](https://nodejs.org) 16 or newer. Nothing to install.

```
node server.js
```

Then open **http://localhost:5173**.

- macOS / Linux: you can also run `./start.sh`
- Windows: double-click `start.bat`
- Different port: `PORT=8080 node server.js`

No Node? `python3 -m http.server 5173` in this folder also works. The site then calls the
model provider straight from the browser instead of through the local server.

## First use

1. Choose a model family: Claude, GPT or Gemini.
2. Paste your API key and press **Verify key**. The app asks the provider which models the
   key can use. That is the verification, and it costs nothing.
3. Pick a model and open the whiteboard.

"Open the demos without a key" lets you try the seven built-in walkthroughs first.

Where to get a key:

| Provider | Keys page |
| --- | --- |
| Claude (Anthropic) | https://console.anthropic.com/settings/keys |
| GPT (OpenAI) | https://platform.openai.com/api-keys |
| Gemini (Google) | https://aistudio.google.com/apikey |

## What you can give it

| Tab | You paste | You get |
| --- | --- | --- |
| Problem link | A LeetCode link | The problem explained on a worked example, with hints. Or press "Show an optimal solution". |
| Link + my solution | The link and your code | Your code traced line by line on the board. Bugs are shown where they happen. |
| Solution + example | Your code and an input | A dry run of that code on that input. No link needed. |

While a walkthrough plays: Space plays and pauses, the arrow keys step, and you can drag the
timeline. Predict mode pauses at decision points and asks what happens next. The Ask tab
answers questions about the step on screen.

## Good to know

- **Your key** stays in your browser (session only, unless you tick "Remember on this
  device") and is sent only to the provider you chose. With `server.js` it passes through
  the local server on your own machine, which neither logs nor stores it.
- **Cost**: each walkthrough is one model request of a few thousand tokens, billed by your
  provider. Stronger models trace more accurately.
- **The link is not downloaded.** The model recognises the problem from the link. For brand
  new, premium or non-LeetCode problems, open "Add the problem statement" and paste the text.
- **Traces are written by the model.** They are usually right on small examples, but a wrong
  value can slip in on tricky code. Re-run on a smaller input if a step looks off.

## Files

```
index.html        the page
css/styles.css    the whiteboard look
js/render.js      drawing engine: one renderer per data structure
js/player.js      playback, timeline, quizzes, sound, voice
js/demos.js       seven built-in walkthroughs (they run the real algorithms)
js/storyboard.js  the prompt the model receives, and validation of its reply
js/llm.js         Claude / GPT / Gemini adapters
js/app.js         connect screen, composer, recents, Ask tab
server.js         local static server + API proxy
```

To add a new kind of drawing (for example system design boxes), add a renderer `R.yourtype`
in `js/render.js` and describe it in the STRUCTURES list in `js/storyboard.js`.
