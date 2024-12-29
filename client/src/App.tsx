import { useState } from 'react'
import {
  Box,
  Container,
  TextField,
  Button,
  Typography,
  Paper,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material'
import axios from 'axios'

interface Character {
  name: string
  handler: string
  bio: string
  description: string
}

interface Message {
  content: string
  isUser: boolean
}

function App() {
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [character, setCharacter] = useState<Character | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [error, setError] = useState('')

  const startScraping = async () => {
    try {
      setIsLoading(true)
      setError('')
      await axios.post('/api/scrape', { username })
      checkStatus()
    } catch (err) {
      setError('Failed to start scraping')
      setIsLoading(false)
    }
  }

  const checkStatus = async () => {
    try {
      const response = await axios.get(`/api/status/${username}`)
      if (response.data.status === 'completed') {
        generateCharacter()
      } else {
        setTimeout(checkStatus, 5000) // Check every 5 seconds
      }
    } catch (err) {
      setError('Failed to check status')
      setIsLoading(false)
    }
  }

  const generateCharacter = async () => {
    try {
      const response = await axios.post('/api/generate-character', { username })
      setCharacter(response.data)
      setIsLoading(false)
    } catch (err) {
      setError('Failed to generate character')
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !username) return

    const userMessage: Message = { content: newMessage, isUser: true }
    setMessages(prev => [...prev, userMessage])
    setNewMessage('')

    try {
      const response = await axios.post('/api/chat', {
        username,
        message: newMessage
      })
      const aiMessage: Message = { content: response.data.response, isUser: false }
      setMessages(prev => [...prev, aiMessage])
    } catch (err) {
      setError('Failed to send message')
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Twitter AI Character Generator
      </Typography>

      {!character ? (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="Twitter Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
            <Button
              variant="contained"
              onClick={startScraping}
              disabled={!username || isLoading}
            >
              {isLoading ? <CircularProgress size={24} /> : 'Generate'}
            </Button>
          </Box>
          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </Paper>
      ) : (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {character.name} (@{character.handler})
            </Typography>
            <Typography variant="body1" paragraph>
              {character.bio}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {character.description}
            </Typography>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <List>
              {messages.map((message, index) => (
                <ListItem key={index} alignItems="flex-start">
                  <ListItemText
                    primary={message.isUser ? 'You' : character.name}
                    secondary={message.content}
                    sx={{
                      textAlign: message.isUser ? 'right' : 'left',
                    }}
                  />
                </ListItem>
              ))}
            </List>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Type your message"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              />
              <Button
                variant="contained"
                onClick={sendMessage}
                disabled={!newMessage.trim()}
              >
                Send
              </Button>
            </Box>
          </Paper>
        </>
      )}
    </Container>
  )
}

export default App 