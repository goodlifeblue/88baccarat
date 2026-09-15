// Article titles are owned by the template. CMS Markdown does not execute HTML.
export default function articleMarkdown() {
  return (tree) => {
    function visit(node) {
      if (node.type === 'heading' && node.depth === 1) node.depth = 2;
      if (node.type === 'html') { node.type = 'text'; node.value = ''; }
      if (node.url && !/^(https?:\/\/|mailto:|\/(?!\/)|#|\.\.?\/)/i.test(node.url)) {
        if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(node.url)) node.url = '';
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}
