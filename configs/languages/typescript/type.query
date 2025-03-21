;; Capture type definitions at the package level

(program
  (type_alias_declaration
    name: (type_identifier) @name
  ) @type
)

;; ...and with an explicit export

(program
  (export_statement
    (type_alias_declaration
      name: (type_identifier) @name
    ) @type
  )
)

;; Capture interface definitions at the package level

(program
  (interface_declaration
    name: (type_identifier) @name
  ) @interface
)

;; ...and with an explicit export

(program
  (export_statement
    (interface_declaration
      name: (type_identifier) @name
    ) @interface
  )
)
