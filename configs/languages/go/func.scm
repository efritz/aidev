;; Capture function definitions at the package level
;; These are not definable within functions, so we don't need an explicit scope check

(function_declaration
  name: (identifier) @name
) @function

;; Capture method definitions
;; These are not definable within functions, so we don't need an explicit scope check

(method_declaration
  receiver: (parameter_list)
  name: (field_identifier) @name
) @method
