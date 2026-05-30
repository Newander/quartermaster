import random
import string
import sys
from datetime import datetime
from pprint import pprint
from typing import Any
from typing import Generator

from pydantic import BaseModel


class SearchResult(BaseModel):
    path: str
    caption: str

    def __lt__(self, other: 'SearchResult') -> bool:
        return self.caption < other.caption

    def __gt__(self, other: 'SearchResult') -> bool:
        return self.caption > other.caption


def generate_unique_substrings(text: str, size: int) -> Generator[str, None, None]:
    if size < 1:
        raise ValueError("Size must be at least 1")

    if size > len(text):
        raise ValueError(f"Size {size} is greater than text length {len(text)}")

    seen = set()

    for i in range(len(text) - size + 1):
        substring = text[i:i + size]
        if substring not in seen:
            seen.add(substring)
            yield substring


class SearchDict:
    """ Searchable dictionary with substring search"""

    def __init__(self, max_record_size: int = 100, add_last: bool = True, max_search_word_size: int = 20):
        self.max_search_word_size = max_search_word_size
        self.add_last = add_last
        self.max_record_size = max_record_size
        self.data: dict[str, list[SearchResult]] = {}

    def __repr__(self) -> str:
        return (f"<SearchDict("
                f"add_last={self.add_last}, "
                f"max_record_size={self.max_record_size}, "
                f"items={len(self)})>")

    def __len__(self) -> int:
        return len(self.data)

    def items_num(self) -> int:
        return sum(map(len, self.data.values()))

    def handle_search_word(self, search_word: str) -> str:
        return search_word.strip(' \n\r\0\t-_').lower()[:self.max_search_word_size]

    def add(self, search_word: str, record: SearchResult) -> None:
        if ' None' in record.caption:
            return
        search_word = self.handle_search_word(search_word)
        for substring_size in range(3, len(search_word) + 1):
            for substring in generate_unique_substrings(search_word, substring_size):
                if substring[0] == ' ':
                    continue
                record_list = self.data.get(substring, [])
                if record not in record_list:
                    record_list.append(record)
                    self.data[substring] = record_list

    def seek(self, search_word: str, top: int = 10) -> list[SearchResult]:
        if not (search_word := self.handle_search_word(search_word)):
            return []
        return self.data.get(search_word, [])[:top]

    def sort(self):
        for record_list in self.data.values():
            record_list.sort()

    def memory_usage(self) -> int:
        return get_size(self)

    def memory_usage_readable(self) -> str:
        return format_size(self.memory_usage())


def get_size(obj: Any, seen: set[int] = None) -> int:
    """
    Calculate the memory size of an object in bytes, including nested objects.

    Args:
        obj: The object to measure
        seen: Set of object IDs already counted (to avoid circular references)

    Returns:
        Total size in bytes
    """
    if seen is None:
        seen = set()

    obj_id = id(obj)

    # Avoid counting the same object twice (circular references)
    if obj_id in seen:
        return 0

    seen.add(obj_id)

    # Get size of the object itself
    size = sys.getsizeof(obj)

    # Handle different types of objects
    if isinstance(obj, dict):
        # Add size of all keys and values
        size += sum(get_size(k, seen) + get_size(v, seen) for k, v in obj.items())
    elif hasattr(obj, '__dict__'):
        # Handle objects with __dict__ (custom classes, dataclasses, etc.)
        size += get_size(obj.__dict__, seen)
    elif hasattr(obj, '__iter__') and not isinstance(obj, (str, bytes, bytearray)):
        # Handle iterables (lists, tuples, sets, etc.)
        size += sum(get_size(item, seen) for item in obj)

    return size


def format_size(size_bytes: int) -> str:
    """
    Format byte size into human-readable format.

    Args:
        size_bytes: Size in bytes

    Returns:
        Formatted string (e.g., "1.5 KB", "2.3 MB")
    """
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def generate_random_shelf_entries(count: int = 1000) -> Generator[tuple[str, str, str], None, None]:
    """
    Generate random shelf entries with search_word, path, and caption.

    Args:
        count: Number of entries to generate

    Yields:
        Tuple of (search_word, path, caption)
    """
    # Shelf number components
    prefixes = list(string.ascii_uppercase)

    # Location options
    locations = [
        'North Wing', 'South Wing', 'East Wing', 'West Wing',
        'Main Lobby', 'Front Desk', 'Back Room', 'Central Area',
        'Upper Level', 'Lower Level', 'Ground Floor', 'Second Floor',
        'East Corridor', 'West Corridor', 'Main Hall', 'South Hall',
        'Reception Area', 'Storage Room', 'Equipment Area', 'Training Zone',
        'Locker Room', 'Changing Area', 'Gym Floor', 'Studio Space',
        'Pool Area', 'Sauna Section', 'Cardio Zone', 'Weights Section',
        'Yoga Studio', 'Spin Room', 'Boxing Ring', 'Martial Arts Area',
        'Employee Section', 'Administration', 'Manager Office', 'Staff Room',
        'Maintenance Bay', 'Utility Closet', 'Supply Depot', 'Archive Room',
        'Conference Room', 'Break Room', 'Kitchen Area', 'Cafeteria',
        'Outdoor Patio', 'Garden Area', 'Parking Level', 'Rooftop Section',
        'Basement Level', 'Sub Basement', 'Mezzanine Floor', 'Balcony Area'
    ]

    # Description options
    descriptions = [
        'Storage locker for equipment',
        'Personal belongings area',
        'Gym towels and supplies',
        'Training equipment storage',
        'Member personal items',
        'Yoga mats and blocks',
        'Weights and dumbbells',
        'Cleaning supplies',
        'Spare parts and tools',
        'Lost and found items',
        'First aid supplies',
        'Sports equipment rack',
        'Protein shake supplies',
        'Water bottle storage',
        'Resistance bands area',
        'Boxing gloves section',
        'Jump ropes and accessories',
        'Exercise balls storage',
        'Foam rollers and mats',
        'Workout benches area',
        'Kettlebell collection',
        'Medicine balls section',
        'Spin bike accessories',
        'Rowing machine parts',
        'Treadmill maintenance',
        'Audio equipment storage',
        'Music system supplies',
        'Instructor materials',
        'Class schedule boards',
        'Membership cards area',
        'Contract documents',
        'Financial records',
        'Training certificates',
        'Guest passes storage',
        'Locker keys depot',
        'Access cards section',
        'Uniform storage',
        'Branded merchandise',
        'Promotional materials',
        'Event supplies',
        'Holiday decorations',
        'Safety equipment',
        'Emergency supplies',
        'Backup batteries',
        'Lighting equipment',
        'Ventilation filters',
        'Plumbing supplies',
        'Electrical components',
        'Paint and materials',
        'Furniture parts'
    ]

    used_combinations = set()

    for i in range(1, count + 1):
        # Generate unique shelf number
        prefix = random.choice(prefixes)
        number = random.randint(1, 999)
        shelf_number = f'{prefix}-{number:03d}'

        # Randomly select location and description
        location = random.choice(locations)
        description = random.choice(descriptions)

        # Ensure uniqueness (optional, but helps avoid exact duplicates)
        combination = (shelf_number, location, description)
        if combination in used_combinations:
            # Regenerate with a different number if duplicate
            shelf_number = f'{prefix}-{random.randint(1000, 9999)}'

        used_combinations.add(combination)

        # Build the components
        search_word = f'{shelf_number} {location} {description}'
        path = f'/shelves/{i}'
        caption = f'Shelf {shelf_number}/{location}'

        yield search_word, path, caption


# Usage example
if __name__ == '__main__':
    sd = SearchDict(max_record_size=50)

    sd.add("Jan Iwanowicz dasparadeis@gmail.com", SearchResult(path='path', caption='caption'))
    print(sd.seek("Iwan"))
    pprint(sd.data)

    # Generate 100 random entries
    print(datetime.now(), "Generating 1_500 random shelf entries...")
    for search_word, path, caption in generate_random_shelf_entries(1_500):
        sd.add(search_word, SearchResult(path=path, caption=caption))

    print(datetime.now(), f"Starting sort")
    sd.sort()
    # positive
    print(datetime.now(), f"{sd.seek('admin')=}")
    # negative
    print(datetime.now(), f"{sd.seek('mater', top=5)=}")
    print(datetime.now(), 'Occupied size:', format_size(get_size(sd)))
