;; Capture method definitions, omitting constructors

(method_definition
  name: (property_identifier) @name
  (#not-eq? @name "constructor")
) @method
