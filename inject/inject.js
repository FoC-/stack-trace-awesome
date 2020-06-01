const sanitizerFactory = () => {
  const sanitizer = (message) =>
    [
      [/\s--->\s/g, '\r\n---> '],
      [/(?:\s{3}at\s)|(?:\)\sat\s)/g, '\r\nat '],
      [/---([\w\s]+?)---/g, '\r\n---$1---'],
      [/</g, '&lt;'],
      [/>/g, '&gt;'],
    ]
      .reduce((a, [search, replace]) => a.replace(search, replace), message || '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);

  return sanitizer;
};

const parserFactory = () => {
  const predicate = '^at\\s+';
  const captureTypeMethodName = '(.+?)\\.([^.]*)';
  const captureParameters = '\\((.*?)\\)';
  const optionalCaptureFilePathAndLine = '(\\s+in\\s+([\\w\\d\\\\/.:]+?):(line\\s+\\d+))?';
  const parser = new RegExp(`${predicate}${captureTypeMethodName}${captureParameters}${optionalCaptureFilePathAndLine}`);
  return (line) => parser.exec(line) || [line];
};

const tokenizerFactory = () => {
  const token = {
    dot: () => ({ type: 'dot', value: '.' }),
    coma: () => ({ type: 'coma', value: ',' }),
    colon: () => ({ type: 'colon', value: ':' }),
    space: () => ({ type: 'space', value: ' ' }),
    parenOpen: () => ({ type: 'parenOpen', value: '(' }),
    parenClose: () => ({ type: 'parenClose', value: ')' }),
    type: (t) => ({ type: 'type', value: t, cn: 'sta__type' }),
    identifier: (i) => ({ type: 'identifier', value: i, cn: 'sta__identifier' }),
    method: (m) => ({ type: 'method', value: m, cn: 'sta__method' }),
    filePath: (p) => ({ type: 'filePath', value: p, cn: 'sta__file' }),
    fileLine: (l) => ({ type: 'fileLine', value: l, cn: 'sta__line' }),
    literal: (l) => ({ type: 'literal', value: l }),
  };

  const tokenizer = (match) => {
    if (match.length === 1) {
      return [token.literal(match[0])];
    } else {
      const stream = [];
      stream.push(token.space(), token.space(), token.literal('at'), token.space());

      match[1].split('.').forEach((v) => stream.push(token.type(v), token.dot()));

      stream.push(token.method(match[2]), token.parenOpen());

      if (match[3]) {
        match[3]
          .split(', ')
          .map((p) => p.split(' '))
          .forEach(([type, name]) => {
            stream.push(token.type(type.trim()), token.space(), token.identifier(name.trim()), token.coma(), token.space());
          });

        // remove trailing coma and space
        stream.pop();
        stream.pop();
      }

      stream.push(token.parenClose());

      if (match[4]) {
        stream.push(token.space(), token.filePath(match[5]), token.colon(), token.fileLine(match[6]));
      }

      return stream;
    }
  };

  return tokenizer;
};

const renderFactory = () => {
  const html = ({ cn, value }) => (cn ? `<span class="${cn}">${value}</span>` : value);
  return (stream) => stream.map(html).join('');
};

const rightClickTracker = () => {
  const isValid = (node) => node && Array.from(node.children).every((e) => e.tagName === 'BR') && /stacktrace|stack trace/gi.test(node.innerText);

  let clickedElement;

  document.addEventListener('contextmenu', ({ target }) => {
    clickedElement = isValid(target) ? target : null;
  });

  return () => clickedElement;
};

const prettier = () => {
  const sanitizer = sanitizerFactory();
  const parser = parserFactory();
  const tokenizer = tokenizerFactory();
  const render = renderFactory();
  const tracker = rightClickTracker();

  return (request, sender, sendResponse) => {
    const node = tracker();
    if (request.action === 'beautify' && node) {
      node.classList.add('sta__container');
      node.innerHTML = sanitizer(node.innerText).map(parser).map(tokenizer).map(render).join('\n');
    }
    sendResponse({ value: 'done' });
  };
};

chrome.runtime.onMessage.addListener(prettier());
