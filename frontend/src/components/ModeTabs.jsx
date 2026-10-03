export const MODES = [
  { id: 'advisor', name: 'Open House', sub: 'Course advisor', hint: 'Answers from NYP SEG website' },
  { id: 'lab', name: 'Lab Vision', sub: 'Lecturer / student', hint: 'Sees objects, reads resistors' },
  { id: 'general', name: 'General', sub: 'Any question', hint: 'Everyday smart lens' },
];

export const QUICK = {
  advisor: [
    'What diploma courses does the School of Engineering offer?',
    'Tell me about AI Robotics',
    'Which course is good if I like AI and data?',
    'What facilities does SEG have?',
    'Can I go to university after the diploma?',
    'What are the JAE points for Cloud Engineering?',
  ],
  lab: ['What am I looking at?', 'Read this resistor value', 'How do I measure this?', 'Any safety concern here?'],
  general: ['What is this?', 'Explain this simply', 'Translate this to Chinese', 'Give me a quick summary'],
};

export default function ModeTabs({ mode, setMode }) {
  return (
    <div className="tabs" role="tablist">
      {MODES.map((m) => (
        <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'active' : ''} onClick={() => setMode(m.id)}>
          <b>{m.name}</b>
          <small>{m.sub}</small>
        </button>
      ))}
    </div>
  );
}
