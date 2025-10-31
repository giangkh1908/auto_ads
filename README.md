# Facebook Ads Manager

A modern, full-stack application for managing Facebook advertising campaigns with a beautiful, responsive UI and comprehensive CRUD operations.

## 🚀 Features

### Frontend
- **Modern UI/UX**: Beautiful, responsive design with smooth animations and hover effects
- **Real-time Data Sync**: Live updates from Facebook API
- **CRUD Operations**: Create, Read, Update, Delete campaigns, ad sets, and ads
- **Interactive Dashboard**: Statistics cards, tabbed navigation, and intuitive controls
- **Form Validation**: Multi-step campaign creation with validation
- **Notification System**: Success/error feedback for all operations
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile

### Backend
- **RESTful API**: Complete CRUD endpoints for all ad entities
- **Facebook Integration**: Direct integration with Facebook Marketing API
- **Error Handling**: Comprehensive error handling and logging
- **Modular Architecture**: Clean separation of concerns with controllers, services, and routes

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **CSS** - Custom styling with modern features (Grid, Flexbox, Animations)
- **ES6+** - Modern JavaScript features

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **Facebook Marketing API** - Official Facebook SDK
- **CORS** - Cross-origin resource sharing

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Facebook Developer Account with Marketing API access

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory:
```env
ACCESS_TOKEN=your_facebook_access_token
AD_ACCOUNT_ID=your_ad_account_id
PORT=3001
```

4. Start the backend server:
```bash
npm start
# or for development
npm run dev
```

The backend will be available at `http://localhost:3001`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## 🔧 API Endpoints

### Campaigns
- `GET /api/status` - Get all ads data
- `POST /api/create-campaign` - Create new campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign

### Ad Sets
- `PUT /api/adsets/:id` - Update ad set
- `DELETE /api/adsets/:id` - Delete ad set

### Ads
- `PUT /api/ads/:id` - Update ad
- `DELETE /api/ads/:id` - Delete ad

## 🎨 UI Features

### Dashboard
- **Statistics Cards**: Real-time counts of campaigns, ad sets, ads, and creatives
- **Tabbed Navigation**: Easy switching between different ad types
- **Search & Filter**: Find specific campaigns or ads quickly

### Campaign Management
- **Multi-step Form**: Intuitive 3-step campaign creation process
- **Inline Editing**: Edit campaigns, ad sets, and ads directly in the interface
- **Status Management**: Easy status changes (Active/Paused/Deleted)
- **Real-time Updates**: Changes reflect immediately across the interface

### Modern Design Elements
- **Gradient Backgrounds**: Beautiful color gradients throughout
- **Smooth Animations**: Hover effects, transitions, and loading states
- **Card-based Layout**: Clean, organized information display
- **Responsive Grid**: Adapts to any screen size
- **Status Badges**: Color-coded status indicators
- **Interactive Buttons**: Hover effects and loading states

## 🔄 Data Flow

1. **Frontend** makes API calls to **Backend**
2. **Backend** processes requests and calls **Facebook Marketing API**
3. **Facebook API** returns data to **Backend**
4. **Backend** formats and sends data to **Frontend**
5. **Frontend** updates UI with new data and shows notifications

## 📱 Responsive Design

The application is fully responsive and works on:
- **Desktop** (1200px+): Full layout with sidebar and detailed views
- **Tablet** (768px - 1199px): Adapted layout with collapsible elements
- **Mobile** (320px - 767px): Stacked layout optimized for touch

## 🎯 Key Features

### Real-time Synchronization
- Data automatically refreshes after create/update/delete operations
- Loading states during API calls
- Error handling with user-friendly messages

### User Experience
- Intuitive navigation with clear visual feedback
- Form validation with helpful error messages
- Confirmation dialogs for destructive actions
- Success/error notifications for all operations

### Performance
- Optimized API calls
- Efficient state management
- Smooth animations without performance impact
- Fast loading times

## 🚀 Getting Started

1. **Set up your Facebook Developer Account**:
   - Create a Facebook App
   - Get Marketing API access
   - Generate an access token
   - Get your Ad Account ID

2. **Configure the backend**:
   - Add your credentials to the `.env` file
   - Start the backend server

3. **Start the frontend**:
   - Run the development server
   - Open your browser to `http://localhost:5173`

4. **Create your first campaign**:
   - Click "Create Ad" in the navigation
   - Fill out the campaign details
   - Complete the ad set configuration
   - Add your creative elements
   - Submit and see it appear in the dashboard!

## 🔧 Development

### Project Structure
```
├── backend/
│   ├── src/
│   │   ├── controllers/    # API controllers
│   │   ├── services/       # Business logic
│   │   ├── routes/         # API routes
│   │   └── config/         # Configuration
│   └── server.js           # Main server file
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API services
│   │   └── assets/         # Static assets
│   └── public/             # Public files
└── README.md
```

### Available Scripts

**Backend:**
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

**Frontend:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For support or questions, please open an issue in the repository.

---

**Built with ❤️ using React, Node.js, and Facebook Marketing API**
