export type DrillQuestion = { prompt: string; options: string[]; answer: number; explanation: string };
export type Drill = { id: string; title: string; passage: string; questions: DrillQuestion[] };

// Original demonstration content; these are not questions from an IELTS test.
export const readingDrills: Drill[] = [
  { id: 'urban-gardens', title: 'Urban gardens and city life', passage: 'In several large cities, unused rooftops are being turned into small gardens. These spaces do not produce enough food to supply a whole neighbourhood, but they can provide fresh herbs and vegetables. Researchers have also observed that shared gardens give residents a reason to meet. The main obstacle is not a lack of interest: buildings need safe access, and someone must take responsibility for regular care. Some projects address this by working with schools or local groups, which can share both the work and the harvest.', questions: [
    { prompt: 'What is one benefit of rooftop gardens mentioned in the passage?', options: ['They feed an entire neighbourhood.', 'They help residents meet one another.', 'They eliminate the need for parks.', 'They increase building safety.'], answer: 1, explanation: 'The passage says shared gardens give residents a reason to meet.' },
    { prompt: 'According to the passage, what is the main challenge?', options: ['Residents dislike vegetables.', 'Rooftops receive too little sunlight.', 'Safe access and ongoing care must be arranged.', 'Schools refuse to participate.'], answer: 2, explanation: 'The final sentences identify safe access and regular care as practical obstacles.' },
    { prompt: 'What does the passage say about the amount of food produced?', options: ['It can supply the whole city.', 'It is enough for an entire neighbourhood.', 'It is a small but useful supply.', 'It is mainly sold to restaurants.'], answer: 2, explanation: 'The gardens provide some fresh produce but not enough for a whole neighbourhood.' },
    { prompt: 'How can schools or local groups help?', options: ['By sharing work and produce.', 'By funding new apartment buildings.', 'By restricting public access.', 'By replacing all city parks.'], answer: 0, explanation: 'The passage says groups can share the work and harvest.' },
  ] },
  { id: 'remote-work', title: 'Rethinking remote work', passage: 'Remote work is often described as a simple way to reduce commuting. The effect is more complicated. Employees who work from home may travel less, while some use the time saved to make additional trips. Employers can also reduce office space, but workers may need extra heating or cooling at home. A recent workplace survey found that flexibility was valued most by staff with long journeys. The report cautioned that these findings describe preferences, not a measured reduction in carbon emissions.', questions: [
    { prompt: 'Why does the passage describe the effect of remote work as complicated?', options: ['It always increases commuting.', 'Changes in travel and home energy use can offset benefits.', 'Employers cannot reduce office space.', 'Workers prefer longer journeys.'], answer: 1, explanation: 'The text describes fewer commutes but possible extra trips and home energy use.' },
    { prompt: 'Who valued flexibility most in the survey?', options: ['Staff with long commutes.', 'Managers with large offices.', 'People who made extra trips.', 'Employees working in transport.'], answer: 0, explanation: 'The survey found flexibility was valued most by staff with long journeys.' },
    { prompt: 'What limitation did the report acknowledge?', options: ['It surveyed only employers.', 'It measured energy use but not preferences.', 'It described preferences rather than measuring emissions.', 'It excluded people working from home.'], answer: 2, explanation: 'The report explicitly says its findings concern preferences, not measured emissions.' },
    { prompt: 'Which statement is supported by the passage?', options: ['Remote work guarantees lower emissions.', 'Home workers never travel during the day.', 'Office space may be reduced by employers.', 'Long commutes are preferred by most staff.'], answer: 2, explanation: 'The passage says employers can reduce office space.' },
  ] },
];

export const listeningScripts = [
  { id: 'library', title: 'A library orientation', text: 'Hello, everyone. The library opens at eight thirty on weekdays and at ten on Saturdays. Please return books at the desk beside the east entrance. Group study rooms are on the second floor; reserve one online at least a day in advance. The small café is next to the main reading room, but it closes at four. If you need a quiet place after that, the research area remains open until six.' },
  { id: 'fieldwork', title: 'Planning a field study', text: 'Our ecology class will visit Green Lake on Thursday, not Wednesday as first planned. The bus leaves campus at quarter past seven, so please arrive by seven. Bring a notebook, a reusable water bottle, and a rain jacket. We will meet Dr Tran at the northern gate. Lunch is provided, but students should bring their own snacks. The return bus is scheduled for half past three.' },
];

export const officialLinks = [
  { label: 'Official IELTS Academic sample tasks', href: 'https://ielts.org/take-a-test/preparation-resources/sample-test-questions/academic-test' },
  { label: 'IELTS test format and timing', href: 'https://ielts.org/take-a-test/test-types/ielts-academic-test' },
  { label: 'Writing band descriptors', href: 'https://ielts.org/cdn/Guides/ielts-writing-band-descriptors.pdf' },
  { label: 'Speaking band descriptors', href: 'https://ielts.org/cdn/ielts-guides/ielts-speaking-band-descriptors.pdf' },
  { label: 'Computer familiarisation test', href: 'https://takeielts.britishcouncil.org/prepare/ielts-free-practice-mock-tests/ielts-familiarisation-test' },
];

export const taskPrompts = {
  task1: { prompt: 'The table shows the percentage of commuters using four types of transport in a city in 2010 and 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.', rows: [['Transport', '2010', '2025'], ['Car', '52%', '41%'], ['Bus', '24%', '29%'], ['Bicycle', '9%', '16%'], ['Walking', '15%', '14%']] },
  task2: { prompt: 'Some people believe that university students should study subjects that are useful for future careers. Others think students should be free to study any subject they are interested in. Discuss both views and give your own opinion.' },
};

export const cueCards = [
  'Describe a skill you learned that has been useful in your work or studies. Say what it is, how you learned it, and explain why it is useful.',
  'Describe a place in your city where you like to spend time. Say where it is, what you do there, and explain why you enjoy it.',
  'Describe a time you worked with other people to complete a task. Say what the task was, who you worked with, and explain how you felt about the result.',
];
