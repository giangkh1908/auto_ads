import { useNavigate } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import { 
  ThumbsUp, 
  MessageCircle, 
  ShoppingBag, 
  Megaphone, 
  Coins,
  Home,
  Sparkles
} from 'lucide-react'
import { ROUTES } from '../../constants/app.constants'
import './NotFound.css'

function NotFound() {
  const navigate = useNavigate()

  // Animation variants cho các icon bay
  const floatingIcon = {
    initial: { y: 0, rotate: 0 },
    animate: {
      y: [0, -20, 0],
      rotate: [0, 10, -10, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  }

  // Animation cho số 404 wobble
  const wobble404 = {
    animate: {
      rotate: [0, -2, 2, -2, 2, 0],
      scale: [1, 1.02, 1, 1.02, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  }

  // Animation cho Buddha robot
  const buddhaAnimation = {
    animate: {
      y: [0, -10, 0],
      rotate: [0, 1, -1, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  }

  // Animation cho neural circuits
  const neuralCircuit = {
    animate: {
      scale: [1, 1.2, 1],
      opacity: [0.5, 1, 0.5],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  }

  // Icons với vị trí và delay khác nhau
  const icons = [
    { Icon: ThumbsUp, x: '10%', y: '20%', delay: 0 },
    { Icon: MessageCircle, x: '85%', y: '25%', delay: 0.5 },
    { Icon: ShoppingBag, x: '15%', y: '70%', delay: 1 },
    { Icon: Megaphone, x: '80%', y: '65%', delay: 1.5 },
    { Icon: Coins, x: '5%', y: '45%', delay: 2 },
    { Icon: Sparkles, x: '90%', y: '50%', delay: 2.5 }
  ]

  return (
    <div className="notfound-container">
      {/* Background gradient */}
      <div className="notfound-background" />
      
      {/* Floating icons */}
      {icons.map((iconData, index) => {
        const { Icon, x, y, delay } = iconData;
        return (
          <motion.div
            key={index}
            className="floating-icon"
            style={{
              position: 'absolute',
              left: x,
              top: y,
            }}
            variants={floatingIcon}
            initial="initial"
            animate="animate"
            transition={{ delay }}
          >
            <Icon size={40} className="icon-fb" />
          </motion.div>
        );
      })}

      {/* Main content */}
      <div className="notfound-content">
        {/* Neural circuits above Buddha */}
        <div className="neural-circuits">
          <motion.div
            className="circuit circuit-1"
            variants={neuralCircuit}
            animate="animate"
          />
          <motion.div
            className="circuit circuit-2"
            variants={neuralCircuit}
            animate="animate"
            transition={{ delay: 0.5 }}
          />
          <motion.div
            className="circuit circuit-3"
            variants={neuralCircuit}
            animate="animate"
            transition={{ delay: 1 }}
          />
        </div>

        {/* Buddha robot */}
        <motion.div
          className="buddha-robot"
          variants={buddhaAnimation}
          animate="animate"
        >
          {/* <div className="buddha-face">🤖</div>
          <div className="buddha-body">🧘</div> */}
        </motion.div>

        {/* Speech bubble */}
        <motion.div
          className="speech-bubble"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
        >
          <p>"Ồ, đoán xem ai đi lạc đây?"</p>
        </motion.div>

        {/* 404 Number */}
        <motion.div
          className="error-number"
          variants={wobble404}
          animate="animate"
        >
          404
        </motion.div>

        {/* Title */}
        <motion.h1
          className="notfound-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          404 - Không tìm thấy trang!
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="notfound-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          Mọi nỗ lực truy cập của bạn không ăn thua đâu, đừng cố nữa!
          <br />
          Quay về đi, bạn sẽ tìm thấy trang mình cần!
        </motion.p>

        {/* Home button */}
        <motion.button
          className="notfound-button"
          onClick={() => navigate(ROUTES.HOME)}
          whileHover={{ scale: 1.1, y: -5 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, type: "spring", stiffness: 300 }}
        >
          <Home size={20} />
          <span>Quay về trang chủ</span>
        </motion.button>
      </div>
    </div>
  )
}

export default NotFound
