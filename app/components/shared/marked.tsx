import Markdown from "marked-react";
import Lowlight from "react-lowlight";
import "react-lowlight/all";
import "highlight.js/styles/monokai-sublime.min.css";

const renderer = {
  code(snippet: string, lang = "js") {
    return <Lowlight language={lang} value={snippet} markers={[]} />;
  },
};

export const MarkedReact = ({ value }: { value: string }) => {
  return (
    <div className="prose dark:prose-invert">
      <Markdown value={value} renderer={renderer} />
    </div>
  );
};
