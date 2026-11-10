import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

const categories = [
  { name: 'History', topics: [['Cleopatra', 'Q635'], ['Silk Road', 'Q36288'], ['Ancient Greece', 'Q11772']] },
  { name: 'Science', topics: [['Black hole', 'Q589'], ['General relativity', 'Q11452'], ['Marie Curie', 'Q7186']] },
  { name: 'Technology', topics: [['Artificial intelligence', 'Q11660'], ['Internet', 'Q75'], ['World Wide Web', 'Q466']] },
  { name: 'Art and Culture', topics: [['Mona Lisa', 'Q12418'], ['Ukiyo-e', 'Q185905'], ['Jazz', 'Q8341']] },
  { name: 'Geography', topics: [['Nile', 'Q3392'], ['Himalayas', 'Q5451'], ['Pacific Ocean', 'Q98']] },
  { name: 'Philosophy', topics: [['Stoicism', 'Q48235'], ['Ethics', 'Q9465'], ['Epistemology', 'Q9471']] },
  { name: 'People', topics: [['Leonardo da Vinci', 'Q762'], ['Alan Turing', 'Q7251'], ['Ibn al-Haytham', 'Q11104']] },
  { name: 'Nature', topics: [['Coral reef', 'Q11292'], ['Monarch butterfly', 'Q212398'], ['Amazon rainforest', 'Q177567']] },
] as const;

export function BrowseTopics({ onExplore }: { onExplore: (id: string) => void }) {
  const [category, setCategory] = useState<(typeof categories)[number]>(categories[0]);
  return <section className="browse-topics" aria-labelledby="browse-topics-title">
    <div className="eyebrow">FIND YOUR STARTING POINT</div>
    <h2 id="browse-topics-title">Explore by category</h2>
    <div className="topic-categories" role="group" aria-label="Topic categories">
      {categories.map(choice => <button key={choice.name} type="button" aria-pressed={category === choice}
        onClick={() => setCategory(choice)}>{choice.name}</button>)}
    </div>
    <ul aria-label={`${category.name} starting topics`}>
      {category.topics.map(([label, id]) => <li key={id}>
        <a href={`/?entity=${id}`} onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onExplore(id);
        }}>{label} <ArrowUpRight aria-hidden="true" size={17}/></a>
      </li>)}
    </ul>
  </section>;
}
