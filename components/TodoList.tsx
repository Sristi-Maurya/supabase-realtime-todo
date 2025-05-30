import { Database } from '@/lib/schema'
import { Session, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useEffect, useState } from 'react'

type Todos = Database['public']['Tables']['todos']['Row']
type Profile = { id: string; email: string }

export default function TodoList({ session }: { session: Session }) {
  const supabase = useSupabaseClient<Database>()
  const [todos, setTodos] = useState<Todos[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [newTaskText, setNewTaskText] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [errorText, setErrorText] = useState('')
  const [filter, setFilter] = useState<'all' | 'assigned' | 'created' | 'overdue' | 'today'>('all')

  const user = session.user

  // Fetch users for assignment
  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
      if (data) setUsers(data)
      if (error) setErrorText(error.message)
    }
    fetchUsers()
  }, [supabase])

  // Fetch todos
  const fetchTodos = async () => {
    const { data: todos, error } = await supabase
      .from('todos')
      .select('*')
      .order('id', { ascending: true })

    if (error) console.log('error', error)
    else setTodos(todos)
  }

  useEffect(() => {
    fetchTodos()
    // eslint-disable-next-line
  }, [supabase])

  // Realtime subscription for todos table
  useEffect(() => {
    const channel = supabase
      .channel('todos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos' },
        (payload) => {
          // If a new todo is assigned to the current user, show alert
          if (
            payload.eventType === 'INSERT' &&
            payload.new.assigned_to === user.id
          ) {
            alert('A new task has been assigned to you!')
          }
          // Refresh todos on any change
          fetchTodos()
        }
      )
      .subscribe()

    // Clean up when component unmounts
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line
  }, [supabase, user.id])

  // Add todo with assignment and due date
  const addTodo = async () => {
    let task = newTaskText.trim()
    if (task.length && assignedTo && dueDate) {
      const { data: todo, error } = await supabase
        .from('todos')
        .insert({
          task,
          user_id: user.id,
          assigned_to: assignedTo,
          due_date: dueDate,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) {
        setErrorText(error.message)
      } else {
        setTodos([...todos, todo])
        setNewTaskText('')
        setAssignedTo('')
        setDueDate('')
      }
    } else {
      setErrorText('Please fill in all fields.')
    }
  }

  const deleteTodo = async (id: number) => {
    try {
      await supabase.from('todos').delete().eq('id', id).throwOnError()
      setTodos(todos.filter((x) => x.id != id))
    } catch (error) {
      console.log('error', error)
    }
  }

  // FILTER LOGIC
  const todayStr = new Date().toISOString().split('T')[0]

  const filteredTodos = todos.filter(todo => {
    if (filter === 'assigned') {
      return todo.assigned_to === user.id
    }
    if (filter === 'created') {
      return todo.created_by === user.id
    }
    if (filter === 'overdue') {
      return !todo.is_complete && todo.due_date && todo.due_date < todayStr
    }
    if (filter === 'today') {
      return todo.due_date === todayStr
    }
    return true // 'all'
  })

  return (
    <div className="w-full">
      <h1 className="mb-6">Todo List</h1>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilter('all')} className={filter === 'all' ? 'font-bold underline' : ''}>All</button>
        <button onClick={() => setFilter('assigned')} className={filter === 'assigned' ? 'font-bold underline' : ''}>Assigned to Me</button>
        <button onClick={() => setFilter('created')} className={filter === 'created' ? 'font-bold underline' : ''}>Created by Me</button>
        <button onClick={() => setFilter('overdue')} className={filter === 'overdue' ? 'font-bold underline' : ''}>Overdue</button>
        <button onClick={() => setFilter('today')} className={filter === 'today' ? 'font-bold underline' : ''}>Due Today</button>
      </div>

      {/* Add Todo Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          addTodo()
        }}
        className="flex flex-col gap-2 my-2"
      >
        <input
          className="rounded w-full p-2"
          type="text"
          placeholder="Task"
          value={newTaskText}
          onChange={(e) => {
            setErrorText('')
            setNewTaskText(e.target.value)
          }}
          required
        />
        <select
          className="rounded w-full p-2"
          value={assignedTo}
          onChange={e => setAssignedTo(e.target.value)}
          required
        >
          <option value="">Assign to...</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.email}</option>
          ))}
        </select>
        <input
          className="rounded w-full p-2"
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          required
        />
        <button className="btn-black" type="submit">
          Add
        </button>
      </form>
      {!!errorText && <Alert text={errorText} />}
      <div className="bg-white shadow overflow-hidden rounded-md">
        <ul>
          {filteredTodos.map((todo) => (
            <Todo
              key={todo.id}
              todo={todo}
              users={users}
              onDelete={() => deleteTodo(todo.id)}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

const Todo = ({
  todo,
  users,
  onDelete,
}: {
  todo: Todos
  users: Profile[]
  onDelete: () => void
}) => {
  const supabase = useSupabaseClient<Database>()
  const [isCompleted, setIsCompleted] = useState(todo.is_complete)

  const toggle = async () => {
    try {
      const { data } = await supabase
        .from('todos')
        .update({ is_complete: !isCompleted })
        .eq('id', todo.id)
        .throwOnError()
        .select()
        .single()

      if (data) setIsCompleted(data.is_complete)
    } catch (error) {
      console.log('error', error)
    }
  }

  // Find assigned user's email
  const assignedUser = users.find(u => u.id === todo.assigned_to)

  return (
    <li className="w-full block cursor-pointer hover:bg-200 focus:outline-none focus:bg-200 transition duration-150 ease-in-out">
      <div className="flex items-center px-4 py-4 sm:px-6">
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="text-sm leading-5 font-medium truncate">{todo.task}</div>
          {todo.assigned_to && (
            <div className="text-xs text-gray-500">
              Assigned to: {assignedUser ? assignedUser.email : todo.assigned_to}
            </div>
          )}
          {todo.due_date && (
            <div className="text-xs text-gray-500">
              Due: {todo.due_date}
            </div>
          )}
        </div>
        <div>
          <input
            className="cursor-pointer"
            onChange={toggle}
            type="checkbox"
            checked={!!isCompleted}
          />
        </div>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete()
          }}
          className="w-4 h-4 ml-2 border-2 hover:border-black rounded"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="gray">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </li>
  )
}

const Alert = ({ text }: { text: string }) => (
  <div className="rounded-md bg-red-100 p-4 my-3">
    <div className="text-sm leading-5 text-red-700">{text}</div>
  </div>
)
