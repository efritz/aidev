"""
Python test file for indexing functionality.
Tests classes, methods, functions, and nested functions.
"""

import os
from typing import List, Optional


# Top-level function - should be captured
def top_level_function():
    """A top-level function."""
    return "hello"


# Top-level function with parameters - should be captured
def calculate_sum(a: int, b: int) -> int:
    """Calculate sum of two numbers."""
    return a + b


# Class definition - should be captured
class ExampleClass:
    """An example class with various methods."""
    
    # Constructor - should NOT be captured (dunder method)
    def __init__(self, name: str):
        self.name = name
        self._private_attr = "private"
    
    # String representation - should NOT be captured (dunder method)
    def __str__(self) -> str:
        return f"ExampleClass({self.name})"
    
    # Regular method - should be captured
    def get_name(self) -> str:
        """Get the name."""
        return self.name
    
    # Method with parameters - should be captured
    def set_name(self, name: str) -> None:
        """Set the name."""
        self.name = name
    
    # Private method - should be captured (single underscore is not dunder)
    def _private_method(self) -> str:
        """A private method."""
        return self._private_attr
    
    # Static method - should be captured
    @staticmethod
    def static_method() -> str:
        """A static method."""
        return "static"
    
    # Class method - should be captured
    @classmethod
    def class_method(cls) -> str:
        """A class method."""
        return cls.__name__
    
    # Method with nested function - method should be captured, nested function should be captured
    def method_with_nested(self) -> str:
        """Method containing a nested function."""
        
        # Nested function - should be captured
        def nested_helper(prefix: str) -> str:
            """A nested helper function."""
            return f"{prefix}: {self.name}"
        
        return nested_helper("Result")


# Another class - should be captured
class AnotherClass:
    """Another example class."""
    
    # Constructor - should NOT be captured (dunder method)
    def __init__(self, value: int):
        self.value = value
    
    # Method - should be captured
    def get_value(self) -> int:
        """Get the value."""
        return self.value


# Function with nested functions - all should be captured
def outer_function(items: List[str]) -> List[str]:
    """Function with nested functions."""
    
    # First nested function - should be captured
    def filter_empty(items: List[str]) -> List[str]:
        """Filter out empty strings."""
        return [item for item in items if item.strip()]
    
    # Second nested function - should be captured
    def capitalize_items(items: List[str]) -> List[str]:
        """Capitalize all items."""
        return [item.capitalize() for item in items]
    
    # Third nested function with its own nested function - both should be captured
    def process_items(items: List[str]) -> List[str]:
        """Process items with nested processing."""
        
        # Deeply nested function - should be captured
        def add_prefix(item: str) -> str:
            """Add prefix to item."""
            return f"processed: {item}"
        
        return [add_prefix(item) for item in items]
    
    filtered = filter_empty(items)
    capitalized = capitalize_items(filtered)
    return process_items(capitalized)


# Class with inheritance - should be captured
class ChildClass(ExampleClass):
    """A child class."""
    
    # Constructor - should NOT be captured (dunder method)
    def __init__(self, name: str, age: int):
        super().__init__(name)
        self.age = age
    
    # Override method - should be captured
    def get_name(self) -> str:
        """Override get_name method."""
        return f"{self.name} (age: {self.age})"
    
    # New method - should be captured
    def get_age(self) -> int:
        """Get the age."""
        return self.age


# Function that returns a function - both should be captured
def create_multiplier(factor: int):
    """Create a multiplier function."""
    
    # Nested function - should be captured
    def multiplier(value: int) -> int:
        """Multiply value by factor."""
        return value * factor
    
    return multiplier


# Lambda functions are not captured by our queries (they don't have names in the AST)
double = lambda x: x * 2
triple = lambda x: x * 3


# Function with decorator - should be captured
@staticmethod
def decorated_function() -> str:
    """A decorated function."""
    return "decorated"


if __name__ == "__main__":
    # Test the functionality
    example = ExampleClass("test")
    print(example.get_name())
    print(example.method_with_nested())
    
    items = ["  hello  ", "", "world", "  "]
    processed = outer_function(items)
    print(processed)
    
    child = ChildClass("child", 10)
    print(child.get_name())
    print(child.get_age())
    
    mult = create_multiplier(5)
    print(mult(3))
    
    print(double(4))
    print(triple(4))
    print(decorated_function())