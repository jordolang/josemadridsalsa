import React from 'react';
export default function FooList({ foos }) {
    return /*#__PURE__*/ React.createElement("div", {
        className: "foo-list container mx-auto px-4 py-8"
    }, /*#__PURE__*/ React.createElement("h2", {
        className: "font-bold text-center mb-8"
    }, "Foo List"), /*#__PURE__*/ React.createElement("p", {
        className: "text-gray-700 text-center"
    }, "You can modify this component at", ' ', /*#__PURE__*/ React.createElement("code", null, "`themes/sample/src/pages/all/EveryWhere.tsx`")), /*#__PURE__*/ React.createElement("div", {
        className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    }, foos?.map((foo)=>/*#__PURE__*/ React.createElement("div", {
            key: foo.id,
            className: "bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300"
        }, /*#__PURE__*/ React.createElement("h3", {
            className: "font-semibold mb-3 text-gray-800"
        }, foo.name), /*#__PURE__*/ React.createElement("p", {
            className: "text-gray-600 leading-relaxed"
        }, foo.description)))));
}
export const layout = {
    areaId: 'content',
    sortOrder: 30
};
export const query = `
  query Query {
    foos {
      id
      name
      description
    }
  }
`;
