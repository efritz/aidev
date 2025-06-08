;; Capture method definitions within classes, excluding dunder methods

(class_definition
  body: (block
    (function_definition
      name: (identifier) @name
      (#not-match? @name "^__.*__$")
    ) @method
  )
)