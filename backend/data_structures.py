class MaintenanceList:

    def __init__(self):
        self.records = []

    # Add a maintenance record
    def add_record(self, record):
        self.records.append(record)

    # Display all records
    def get_records(self):
        return self.records

    # Search for a record
    def search_record(self, record_id):
        for record in self.records:
            if record["record_id"] == record_id:
                return record
        return None

    # Delete a record
    def delete_record(self, record_id):
        self.records = [
            record for record in self.records
            if record["record_id"] != record_id
        ]
class ActivityStack:

    def __init__(self):
        self.activities = []

    # Add new activity
    def push(self, activity):
        self.activities.append(activity)

    # Retrieve latest activity
    def pop(self):
        if not self.is_empty():
            return self.activities.pop()
        return None

    # View latest activity
    def peek(self):
        if not self.is_empty():
            return self.activities[-1]
        return None

    # Check whether stack is empty
    def is_empty(self):
        return len(self.activities) == 0

    # Display all activities
    def get_activities(self):
        return self.activities[::-1]

from collections import deque


class MaintenanceQueue:

    def __init__(self):
        self.tasks = deque()

    # Add task to queue
    def enqueue(self, task):
        self.tasks.append(task)

    # Remove oldest task
    def dequeue(self):
        if not self.is_empty():
            return self.tasks.popleft()
        return None

    # View oldest task
    def peek(self):
        if not self.is_empty():
            return self.tasks[0]
        return None

    # Check if queue is empty
    def is_empty(self):
        return len(self.tasks) == 0

    # View all tasks
    def get_tasks(self):
        return list(self.tasks)

class ComponentNode:

    def __init__(self, name):
        self.name = name
        self.children = []


class VesselComponentTree:

    def __init__(self, vessel_name):
        self.root = ComponentNode(vessel_name)

    # Find a component in the tree
    def find_component(self, node, name):

        if node.name == name:
            return node

        for child in node.children:
            result = self.find_component(child, name)

            if result:
                return result

        return None

    # Add a subcomponent
    def add_component(self, parent_name, component_name):

        parent = self.find_component(
            self.root, parent_name
        )

        if parent:
            new_node = ComponentNode(component_name)
            parent.children.append(new_node)
            return True

        return False

    # Display the complete hierarchy
    def display_tree(self, node=None):

        if node is None:
            node = self.root

        return {
            "name": node.name,
            "children": [
                self.display_tree(child)
                for child in node.children
            ]
        }

class OperationalGraph:

    def __init__(self):
        self.graph = {}

    # Add a node
    def add_node(self, node):
        if node not in self.graph:
            self.graph[node] = []

    # Connect two nodes
    def add_connection(self, node1, node2):

        self.add_node(node1)
        self.add_node(node2)

        if node2 not in self.graph[node1]:
            self.graph[node1].append(node2)

        if node1 not in self.graph[node2]:
            self.graph[node2].append(node1)

    # Display graph
    def get_graph(self):
        return self.graph

    # Breadth First Search
    def bfs(self, start):

        if start not in self.graph:
            return []

        visited = []
        queue = deque([start])

        while queue:
            node = queue.popleft()

            if node not in visited:
                visited.append(node)

                for neighbour in self.graph[node]:
                    if neighbour not in visited:
                        queue.append(neighbour)

        return visited

    # Depth First Search
    def dfs(self, start):

        if start not in self.graph:
            return []

        visited = []

        def traverse(node):
            if node not in visited:
                visited.append(node)

                for neighbour in self.graph[node]:
                    traverse(neighbour)

        traverse(start)

        return visited