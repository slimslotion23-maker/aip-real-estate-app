import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';

// Lucide React Icons for a clean look
import { Sparkles, Trash2, Save, MapPin, XCircle, CheckCircle, ListTodo, DollarSign, Users, Phone, Mail, User, Search, BarChart3, Home, Contact, LayoutDashboard, Flag, ArrowUp, ArrowDown, Clock, Lightbulb, TrendingUp, Sun, Moon, Link, Settings, FileText, Calendar, Cloud, Globe, MessageCircle, PanelLeft, PanelRight } from 'lucide-react';

// Recharts for data visualization
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

// shadcn/ui Card component for better structure
const Card = ({ children, className, ...props }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 ${className}`} {...props}>
    {children}
  </div>
);

// --- Global Firebase and Auth setup ---
// The following Firebase variables are provided by the canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : undefined;

let app;
let auth;
let db;

// Initialize Firebase App only if configuration is available
if (Object.keys(firebaseConfig).length > 0) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
}

// Reusable custom toast message component
const showToast = (message, isError = false) => {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 text-white px-4 py-2 rounded-full shadow-lg transition-all duration-300 ${isError ? 'bg-red-500' : 'bg-green-500'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => document.body.removeChild(toast), 500);
  }, 3000);
};

// Reusable Confirmation modal component
const ConfirmationModal = ({ show, title, message, onConfirm, onCancel }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 z-50 overflow-y-auto h-full w-full flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-11/12 md:w-2/3 lg:w-1/3 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 scale-100">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-6 py-2 rounded-full text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 rounded-full text-white bg-red-600 hover:bg-red-700 transition-colors duration-200"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// Map component using a unique ref to prevent conflicts
const MapComponent = ({ lat, lng }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    // Only proceed if Leaflet library is available and coordinates are valid
    if (typeof L === 'undefined' || isNaN(lat) || isNaN(lng) || !mapContainerRef.current) {
      return;
    }

    // Clean up previous map instance if it exists to prevent multiple maps
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    // Create a new map instance
    mapInstanceRef.current = L.map(mapContainerRef.current).setView([lat, lng], 13);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapInstanceRef.current);

    // Add a marker to the map
    L.marker([lat, lng]).addTo(mapInstanceRef.current);

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
    };
  }, [lat, lng]);

  return <div ref={mapContainerRef} className="w-full h-80 rounded-2xl shadow-inner mt-6"></div>;
};

// Modal for document generation
const DocumentModal = ({ show, title, content, onClose }) => {
  if (!show) return null;

  const copyToClipboard = async () => {
    try {
      // Use the modern clipboard API
      await navigator.clipboard.writeText(content);
      showToast('Content copied to clipboard!');
    } catch (e) {
      console.error('Failed to copy to clipboard:', e);
      // Fallback for older browsers or permission issues
      try {
        const el = document.createElement('textarea');
        el.value = content;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast('Content copied to clipboard via fallback!');
      } catch (err) {
        console.error('Failed to copy using fallback:', err);
        showToast('Failed to copy. Please copy manually.', true);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 z-50 overflow-y-auto h-full w-full flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-3xl border border-gray-200 dark:border-gray-700 transform transition-all duration-300 scale-100 relative">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:hover:text-white">
          <XCircle className="w-6 h-6" />
        </button>
        <div className="prose dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-800 p-6 rounded-xl overflow-y-auto max-h-[70vh]">
          <pre className="whitespace-pre-wrap font-sans text-sm">{content}</pre>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-4 sm:space-y-0 sm:space-x-4">
          <button
            onClick={copyToClipboard}
            className="px-6 py-2 rounded-full text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center"
          >
            <Link className="w-5 h-5 mr-2" />
            Copy to Clipboard
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 justify-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Component for the main lead generation form and results
const LeadGenerator = ({
  propertyDetails, setPropertyDetails, latitude, setLatitude, longitude, setLongitude,
  imageFile, setImageFile, findLeads, isLoading, results, error, showPropertyDetails,
  togglePropertyDetails, saveIdea, userId, setSaveMessage
}) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showFullSummary, setShowFullSummary] = useState(false);
  const handleFindLeads = async () => {
    await findLeads(propertyDetails, latitude, longitude, imageFile);
  };
  const handleSaveIdea = () => {
    if (results) {
      saveIdea(propertyDetails, results, latitude, longitude);
      setSaveMessage('Lead saved to Deal Flow!');
    } else {
      showToast('No lead to save. Generate a lead first.', true);
    }
  };
  return (
    <Card className="flex-1">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 flex items-center">
        <Sparkles className="w-8 h-8 mr-3 text-yellow-400" />
        AI Lead Generator
      </h2>
      <div className="space-y-4">
        <textarea
          className="w-full p-4 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows="6"
          placeholder="Enter property details (e.g., '10 acres of wooded land on Main Street, Elkton, MD')"
          value={propertyDetails}
          onChange={(e) => setPropertyDetails(e.target.value)}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="number"
            className="w-full p-4 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Latitude (e.g., 39.6083)"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
          />
          <input
            type="number"
            className="w-full p-4 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Longitude (e.g., -75.8364)"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
          />
        </div>
        <label className="flex items-center space-x-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files[0])}
          />
          <Cloud className="w-6 h-6 text-gray-500" />
          <span className="text-gray-600 dark:text-gray-400">
            {imageFile ? `Image selected: ${imageFile.name}` : 'Upload Property Image (optional)'}
          </span>
        </label>
        <button
          onClick={handleFindLeads}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white font-bold py-4 px-6 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <span className="animate-pulse">Analyzing...</span>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>Generate Lead</span>
            </>
          )}
        </button>
      </div>
      {error && <div className="mt-4 text-red-500 font-medium">{error}</div>}
      {results && (
        <Card className="mt-6 border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-950">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Generated Lead</h3>
          <div className="prose dark:prose-invert max-w-none space-y-4">
            <h4 className="font-semibold text-lg">Property Summary</h4>
            <p className="text-gray-700 dark:text-gray-300">
              {showFullSummary ? results.detailedPropertySummary : `${results.detailedPropertySummary.substring(0, 200)}...`}
            </p>
            <button onClick={() => setShowFullSummary(!showFullSummary)} className="text-blue-500 hover:text-blue-700 transition-colors text-sm font-medium">
              {showFullSummary ? 'Read Less' : 'Read More'}
            </button>
            <h4 className="font-semibold text-lg mt-4">Suggested Offer Range</h4>
            <p className="font-bold text-blue-600 dark:text-blue-300 text-xl">{results.suggestedOfferRange}</p>
            <h4 className="font-semibold text-lg mt-4">Buyer Profiles</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              {results.buyerProfiles.map((profile, index) => <li key={index}>{profile}</li>)}
            </ul>
            <h4 className="font-semibold text-lg mt-4">Seller Outreach Angles</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              {results.sellerOutreachAngles.map((angle, index) => <li key={index}>{angle}</li>)}
            </ul>
            <h4 className="font-semibold text-lg mt-4">Due Diligence Checklist</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              {results.dueDiligenceChecklist.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveIdea}
              className="bg-green-500 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-green-600 transition-all duration-300 flex items-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>Save Lead</span>
            </button>
          </div>
        </Card>
      )}
    </Card>
  );
};

// Component for managing deal flow and saved ideas
const DealFlowManager = ({
  savedIdeas, deleteIdea, togglePropertyDetails, showPropertyDetails, generateOfferLetter,
  isGeneratingOffer, toggleIdeaDeleteModal, ideaToDelete, showIdeaDeleteModal,
  syncToCalendar, runAutomatedLeadSearch, isAutoGenerating, autoGenProgress, importCountyProperties,
  updateLeadStatus
}) => {
  const [ideaSearchTerm, setIdeaSearchTerm] = useState('');

  const filteredIdeas = savedIdeas.filter(idea =>
    (idea.propertyDetails && idea.propertyDetails.toLowerCase().includes(ideaSearchTerm.toLowerCase())) ||
    (idea.userId && idea.userId.toLowerCase().includes(ideaSearchTerm.toLowerCase()))
  );
  
  const statusColors = {
    'New': 'bg-gray-200 text-gray-800',
    'Contacted': 'bg-yellow-200 text-yellow-800',
    'Offer Made': 'bg-blue-200 text-blue-800',
    'Under Contract': 'bg-purple-200 text-purple-800',
    'Sold': 'bg-green-200 text-green-800',
  }
  
  return (
    <Card className="flex-1">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center">
          <ListTodo className="w-8 h-8 mr-3 text-indigo-400" />
          Deal Flow & Leads
        </h2>
        <div className="flex space-x-2">
          <input
            type="text"
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 transition-all"
            placeholder="Search leads..."
            value={ideaSearchTerm}
            onChange={(e) => setIdeaSearchTerm(e.target.value)}
          />
          <button
            onClick={importCountyProperties}
            className="bg-teal-600 text-white font-bold py-2 px-4 rounded-full shadow-lg hover:bg-teal-700 transition-all duration-300 flex items-center justify-center space-x-2"
          >
            <Flag className="w-5 h-5" />
            <span>Import County Properties</span>
          </button>
          <button
            onClick={runAutomatedLeadSearch}
            disabled={isAutoGenerating}
            className="bg-purple-600 text-white font-bold py-2 px-4 rounded-full shadow-lg hover:bg-purple-700 transition-all duration-300 disabled:bg-gray-400 flex items-center justify-center space-x-2"
          >
            <Sparkles className="w-5 h-5" />
            <span>{isAutoGenerating ? 'Generating...' : 'Auto-Generate'}</span>
          </button>
        </div>
      </div>
      {isAutoGenerating && (
        <div className="w-full bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200 p-4 mb-4 rounded-xl shadow-md">
          <p className="font-medium animate-pulse">{autoGenProgress}</p>
        </div>
      )}
      <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-250px)]">
        {filteredIdeas.length > 0 ? (
          filteredIdeas.map((idea) => (
            <Card key={idea.id} className="border-indigo-200 dark:border-indigo-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{idea.propertyDetails}</h3>
                    {idea.source === 'county' && (
                      <span className="bg-teal-500 text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center">
                        <Flag className="w-3 h-3 mr-1" />
                        County Lead
                      </span>
                    )}
                  </div>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-2 space-x-2 flex-wrap">
                    <div className="flex items-center space-x-1">
                      <User className="w-4 h-4" />
                      <span>{idea.userId}</span>
                    </div>
                    <div className="flex items-center space-x-1 ml-4">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(idea.timestamp?.toMillis()).toLocaleString()}</span>
                    </div>
                    {idea.taxAmount && (
                      <div className="flex items-center space-x-1 ml-4">
                        <DollarSign className="w-4 h-4 text-red-500" />
                        <span className="text-red-500">Tax Due: ${idea.taxAmount.toLocaleString()}</span>
                      </div>
                    )}
                    {idea.propertyType && (
                        <div className="flex items-center space-x-1 ml-4">
                          <Home className="w-4 h-4" />
                          <span>Type: {idea.propertyType}</span>
                        </div>
                    )}
                  </div>
                  <div className="mt-4 flex items-center">
                    <span className="font-semibold text-sm text-gray-700 dark:text-gray-300 mr-2">Status:</span>
                    <select
                      value={idea.status || 'New'}
                      onChange={(e) => updateLeadStatus(idea.id, e.target.value)}
                      className={`p-2 rounded-xl text-xs font-medium ${statusColors[idea.status] || statusColors['New']} transition-colors duration-200`}
                    >
                      {Object.keys(statusColors).map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex-shrink-0 flex space-x-2">
                  <button onClick={() => togglePropertyDetails(idea.id)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <MapPin className="w-5 h-5 text-gray-500" />
                  </button>
                  <button onClick={() => toggleIdeaDeleteModal(idea)} className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-800 transition-colors">
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
              {showPropertyDetails[idea.id] && (
                <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                  {idea.generatedResults && (
                    <div className="prose dark:prose-invert max-w-none">
                      <h4 className="font-semibold text-lg">Detailed Summary</h4>
                      <p>{JSON.parse(idea.generatedResults).detailedPropertySummary}</p>
                      <h4 className="font-semibold text-lg mt-4">Due Diligence Checklist</h4>
                      <ul className="list-disc list-inside">
                        {JSON.parse(idea.generatedResults).dueDiligenceChecklist.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-4">
                    <button
                      onClick={() => generateOfferLetter(idea)}
                      disabled={isGeneratingOffer}
                      className="flex-1 bg-blue-600 text-white font-bold py-2 px-4 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center space-x-2 disabled:bg-gray-400"
                    >
                      {isGeneratingOffer ? 'Generating...' : <>
                        <FileText className="w-5 h-5" />
                        <span>Generate Offer</span>
                      </>}
                    </button>
                    <button
                      onClick={() => syncToCalendar(idea)}
                      className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-200 font-bold py-2 px-4 rounded-full shadow-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300 flex items-center justify-center space-x-2"
                    >
                      <Calendar className="w-5 h-5" />
                      <span>Sync to Calendar</span>
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ))
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            <Lightbulb className="w-12 h-12 mx-auto mb-4" />
            <p className="text-lg">No leads saved yet. Generate one in the AI Lead Generator tab!</p>
          </div>
        )}
      </div>
      <ConfirmationModal
        show={showIdeaDeleteModal}
        title="Confirm Deletion"
        message={`Are you sure you want to delete the lead for "${ideaToDelete?.propertyDetails}"? This action cannot be undone.`}
        onConfirm={() => deleteIdea(ideaToDelete?.id)}
        onCancel={() => toggleIdeaDeleteModal(null)}
      />
    </Card>
  );
};

// Component for Financial Analysis
const FinancialAnalysis = ({
  purchasePrice, setPurchasePrice, salesPrice, setSalesPrice,
  closingCosts, setClosingCosts, rehabCosts, setRehabCosts,
  holdingCosts, setHoldingCosts, dealScore, advancedScore,
  marketTrendAnalysis, isMarketAnalysisLoading, runMarketAnalysis,
  compsData, setCompsData, compsInput, setCompsInput,
  compsResults, isCompsLoading, findComparables, showAdvancedAnalysis, setShowAdvancedAnalysis
}) => {
  const [profit, setProfit] = useState(0);
  const [roi, setRoi] = useState(0);

  useEffect(() => {
    const p = parseFloat(purchasePrice) || 0;
    const s = parseFloat(salesPrice) || 0;
    const c = parseFloat(closingCosts) || 0;
    const r = parseFloat(rehabCosts) || 0;
    const h = parseFloat(holdingCosts) || 0;

    const totalCosts = p + c + r + h;
    const calculatedProfit = s - totalCosts;
    const calculatedRoi = totalCosts > 0 ? (calculatedProfit / totalCosts) * 100 : 0;

    setProfit(calculatedProfit);
    setRoi(calculatedRoi);

  }, [purchasePrice, salesPrice, closingCosts, rehabCosts, holdingCosts]);

  const addComp = () => {
    if (compsInput) {
      const newComps = [...compsData, { name: `Comp ${compsData.length + 1}`, price: parseFloat(compsInput), date: new Date().toISOString().slice(0, 10) }];
      setCompsData(newComps);
      setCompsInput('');
    }
  };

  const pieData = [
    { name: 'Purchase Price', value: parseFloat(purchasePrice) || 0, color: '#4B5563' },
    { name: 'Closing Costs', value: parseFloat(closingCosts) || 0, color: '#3B82F6' },
    { name: 'Rehab Costs', value: parseFloat(rehabCosts) || 0, color: '#10B981' },
    { name: 'Holding Costs', value: parseFloat(holdingCosts) || 0, color: '#F97316' },
  ];
  const COLORS = ['#4B5563', '#3B82F6', '#10B981', '#F97316'];

  const lineData = compsData.map(comp => ({
    name: comp.date,
    price: comp.price
  })).sort((a,b) => new Date(a.name) - new Date(b.name));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 flex items-center">
          <DollarSign className="w-8 h-8 mr-3 text-green-400" />
          Financial Analysis
        </h2>
        <div className="space-y-4">
          <input type="number" placeholder="Purchase Price" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-700" />
          <input type="number" placeholder="Estimated Sales Price" value={salesPrice} onChange={(e) => setSalesPrice(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-700" />
          <input type="number" placeholder="Closing Costs" value={closingCosts} onChange={(e) => setClosingCosts(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-700" />
          <input type="number" placeholder="Rehab Costs" value={rehabCosts} onChange={(e) => setRehabCosts(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-700" />
          <input type="number" placeholder="Holding Costs" value={holdingCosts} onChange={(e) => setHoldingCosts(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-700" />
        </div>
        <div className="mt-6 space-y-4 text-gray-900 dark:text-white">
          <div className={`p-4 rounded-xl font-bold text-xl flex justify-between ${profit > 0 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
            <span>Total Profit</span>
            <span>{`$${profit.toLocaleString()}`}</span>
          </div>
          <div className="p-4 rounded-xl bg-gray-100 dark:bg-gray-700 font-bold text-xl flex justify-between">
            <span>ROI</span>
            <span>{`${roi.toFixed(2)}%`}</span>
          </div>
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={() => setShowAdvancedAnalysis(!showAdvancedAnalysis)}
            className="text-blue-500 hover:text-blue-700 font-bold flex items-center justify-center mx-auto"
          >
            {showAdvancedAnalysis ? 'Hide Advanced Analysis' : 'Show Advanced Analysis'}
            {showAdvancedAnalysis ? <ArrowUp className="w-4 h-4 ml-2" /> : <ArrowDown className="w-4 h-4 ml-2" />}
          </button>
        </div>
      </Card>
      {showAdvancedAnalysis && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Cost Breakdown</h3>
            <div className="h-64 flex justify-center items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData.filter(d => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Market Trend Analysis</h3>
            <div className="flex space-x-2 mb-4">
              <input
                type="number"
                className="flex-1 p-2 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-700"
                placeholder="Add recent comp price"
                value={compsInput}
                onChange={(e) => setCompsInput(e.target.value)}
              />
              <button
                onClick={addComp}
                className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-200 font-bold py-2 px-4 rounded-full shadow-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
              >
                Add Comp
              </button>
            </div>
            <button
              onClick={runMarketAnalysis}
              disabled={isMarketAnalysisLoading || compsData.length === 0}
              className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 disabled:bg-gray-400 mb-4 flex items-center justify-center space-x-2"
            >
              <TrendingUp className="w-5 h-5" />
              <span>{isMarketAnalysisLoading ? 'Analyzing...' : 'Run Market Analysis'}</span>
            </button>
            {marketTrendAnalysis && (
              <div className="prose dark:prose-invert max-w-none mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <p>{marketTrendAnalysis}</p>
              </div>
            )}
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-2">Comps Trend</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip />
                  <Line type="monotone" dataKey="price" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// Component for managing contacts
const ContactManager = ({
  sellerName, setSellerName, sellerPhone, setSellerPhone, sellerEmail, setSellerEmail,
  savedContacts, saveContact, deleteContact, showContactDeleteModal, contactToDelete,
  toggleContactDeleteModal
}) => {
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const filteredContacts = savedContacts.filter(contact =>
    (contact.sellerName && contact.sellerName.toLowerCase().includes(contactSearchTerm.toLowerCase())) ||
    (contact.sellerPhone && contact.sellerPhone.toLowerCase().includes(contactSearchTerm.toLowerCase())) ||
    (contact.sellerEmail && contact.sellerEmail.toLowerCase().includes(contactSearchTerm.toLowerCase()))
  );
  const handleSaveContact = () => {
    saveContact({ sellerName, sellerPhone, sellerEmail });
    setSellerName('');
    setSellerPhone('');
    setSellerEmail('');
  };

  return (
    <Card className="flex-1">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 flex items-center">
        <Users className="w-8 h-8 mr-3 text-cyan-400" />
        Contact Manager
      </h2>
      <div className="space-y-4">
        <input type="text" placeholder="Seller Name" value={sellerName} onChange={(e) => setSellerName(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-700" />
        <input type="tel" placeholder="Phone Number" value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-700" />
        <input type="email" placeholder="Email Address" value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-700" />
        <button
          onClick={handleSaveContact}
          className="w-full bg-cyan-600 text-white font-bold py-4 px-6 rounded-full shadow-lg hover:bg-cyan-700 transition-all duration-300 flex items-center justify-center space-x-2"
        >
          <Save className="w-5 h-5" />
          <span>Save Contact</span>
        </button>
      </div>
      <div className="mt-8">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <ListTodo className="w-6 h-6 mr-2" />
          Saved Contacts
        </h3>
        <div className="mb-4">
          <input
            type="text"
            className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-200 transition-all"
            placeholder="Search contacts..."
            value={contactSearchTerm}
            onChange={(e) => setContactSearchTerm(e.target.value)}
          />
        </div>
        <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-250px)]">
          {filteredContacts.length > 0 ? (
            filteredContacts.map((contact) => (
              <Card key={contact.id} className="border-cyan-200 dark:border-cyan-700">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-lg text-gray-900 dark:text-white">{contact.sellerName}</h4>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 space-y-1">
                      {contact.sellerPhone && (
                        <div className="flex items-center space-x-1">
                          <Phone className="w-4 h-4" />
                          <span>{contact.sellerPhone}</span>
                        </div>
                      )}
                      {contact.sellerEmail && (
                        <div className="flex items-center space-x-1">
                          <Mail className="w-4 h-4" />
                          <span>{contact.sellerEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => toggleContactDeleteModal(contact)} className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-800 transition-colors">
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-6">
              <MessageCircle className="w-12 h-12 mx-auto mb-4" />
              <p>No contacts saved yet.</p>
            </div>
          )}
        </div>
      </div>
      <ConfirmationModal
        show={showContactDeleteModal}
        title="Confirm Deletion"
        message={`Are you sure you want to delete the contact for "${contactToDelete?.sellerName}"? This action cannot be undone.`}
        onConfirm={() => deleteContact(contactToDelete?.id)}
        onCancel={() => toggleContactDeleteModal(null)}
      />
    </Card>
  );
};


// Dashboard Component
const Dashboard = ({ savedIdeas, savedContacts }) => {
  // Aggregate data for charts
  const leadStatuses = savedIdeas.reduce((acc, idea) => {
    const status = idea.status || 'New';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.keys(leadStatuses).map(status => ({
    name: status,
    value: leadStatuses[status]
  }));
  const pieColors = {
    'New': '#94a3b8', // blue-gray
    'Contacted': '#fbbf24', // yellow
    'Offer Made': '#60a5fa', // blue
    'Under Contract': '#a855f7', // purple
    'Sold': '#34d399', // green
  };

  return (
    <Card className="flex-1">
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 flex items-center">
        <LayoutDashboard className="w-8 h-8 mr-3 text-sky-400" />
        Dashboard
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-sky-100 dark:bg-sky-900 border-sky-200 dark:border-sky-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-sky-800 dark:text-sky-200">Total Leads</h3>
            <ListTodo className="w-8 h-8 text-sky-600 dark:text-sky-400" />
          </div>
          <p className="text-4xl font-extrabold text-sky-900 dark:text-sky-100">{savedIdeas.length}</p>
        </Card>
        <Card className="bg-green-100 dark:bg-green-900 border-green-200 dark:border-green-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-green-800 dark:text-green-200">Total Contacts</h3>
            <Users className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-4xl font-extrabold text-green-900 dark:text-green-100">{savedContacts.length}</p>
        </Card>
        <Card className="bg-purple-100 dark:bg-purple-900 border-purple-200 dark:border-purple-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-purple-800 dark:text-purple-200">Properties Under Contract</h3>
            <Flag className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-4xl font-extrabold text-purple-900 dark:text-purple-100">
            {savedIdeas.filter(idea => idea.status === 'Under Contract').length}
          </p>
        </Card>
      </div>
      <Card className="mt-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Lead Status Distribution</h3>
        <div className="h-64 flex justify-center items-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                label
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={pieColors[entry.name]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </Card>
  );
};

// Main App Component
const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard'); // State to manage active tab
  const [darkMode, setDarkMode] = useState(true);

  // General app state
  const [propertyDetails, setPropertyDetails] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPropertyDetails, setShowPropertyDetails] = useState({});
  const [showOfferLetterModal, setShowOfferLetterModal] = useState(false);
  const [offerLetterContent, setOfferLetterContent] = useState('');
  const [isGeneratingOffer, setIsGeneratingOffer] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [autoGenProgress, setAutoGenProgress] = useState('');

  // Firestore data state
  const [savedIdeas, setSavedIdeas] = useState([]);
  const [savedContacts, setSavedContacts] = useState([]);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [dbInstance, setDbInstance] = useState(null);
  const [authInstance, setAuthInstance] = useState(null);

  // Modals state
  const [showIdeaDeleteModal, setShowIdeaDeleteModal] = useState(false);
  const [ideaToDelete, setIdeaToDelete] = useState(null);
  const [showContactDeleteModal, setShowContactDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);

  // Financial Analysis state
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salesPrice, setSalesPrice] = useState('');
  const [closingCosts, setClosingCosts] = useState('');
  const [rehabCosts, setRehabCosts] = useState('');
  const [holdingCosts, setHoldingCosts] = useState('');
  const [showAdvancedAnalysis, setShowAdvancedAnalysis] = useState(false);
  const [marketTrendAnalysis, setMarketTrendAnalysis] = useState('');
  const [isMarketAnalysisLoading, setIsMarketAnalysisLoading] = useState(false);
  const [compsData, setCompsData] = useState([]);
  const [compsInput, setCompsInput] = useState('');

  // Contact Manager state
  const [sellerName, setSellerName] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');

  // Function to convert file to base64
  const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });

  // API Call function for text generation (with exponential backoff)
  const callGeminiApi = async (payload) => {
    let delay = 1000; // 1 second
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          if (response.status === 429 && i < maxRetries - 1) { // Rate limit error
            console.warn(`Rate limit hit. Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
            continue;
          }
          throw new Error(`API error: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
          return result.candidates[0].content.parts[0].text;
        } else {
          throw new Error('Unexpected API response format');
        }
      } catch (e) {
        if (i === maxRetries - 1) {
          throw e; // Re-throw if all retries fail
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  };

  // --- Core Application Logic ---

  // Firebase Auth and Data Listeners
  useEffect(() => {
    // Initialize auth and firestore instances
    if (!app) {
      console.error("Firebase not initialized. Check your configuration.");
      return;
    }
    setDbInstance(db);
    setAuthInstance(auth);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        // Sign in anonymously if no user is authenticated
        if (initialAuthToken) {
          try {
            await signInWithCustomToken(auth, initialAuthToken);
          } catch (error) {
            console.error("Error signing in with custom token:", error);
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Firestore onSnapshot listeners for real-time data
  useEffect(() => {
    // Only proceed if authenticated and Firebase instances are ready
    if (!isAuthReady || !dbInstance || !userId) return;

    // Listen for saved ideas
    const ideasCollectionRef = collection(dbInstance, `artifacts/${appId}/users/${userId}/ideas`);
    const unsubscribeIdeas = onSnapshot(ideasCollectionRef, (snapshot) => {
      const ideasData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSavedIdeas(ideasData);
    });

    // Listen for saved contacts
    const contactsCollectionRef = collection(dbInstance, `artifacts/${appId}/users/${userId}/contacts`);
    const unsubscribeContacts = onSnapshot(contactsCollectionRef, (snapshot) => {
      const contactsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSavedContacts(contactsData);
    });

    return () => {
      unsubscribeIdeas();
      unsubscribeContacts();
    };
  }, [isAuthReady, dbInstance, userId]);

  // Main Lead Generation function
  const findLeads = async (details, lat, lng, image) => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    let prompt = `Analyze the following property for potential real estate flipping or development. 
    Property Details: "${details}".`;

    if (lat && lng) {
      prompt += `\nLocation Coordinates: Latitude ${lat}, Longitude ${lng}.`;
    }

    prompt += `\n\nGenerate a detailed response in JSON format with the following keys: 
    "detailedPropertySummary": a comprehensive analysis of the property, its potential, and surrounding market.
    "suggestedOfferRange": a calculated offer range based on the analysis (e.g., "$150,000 - $180,000").
    "buyerProfiles": an array of ideal buyer profiles for this property.
    "sellerOutreachAngles": an array of persuasive angles for contacting the seller.
    "dueDiligenceChecklist": an array of critical items for due diligence.`;

    const payload = {
      generationConfig: {
        responseMimeType: "application/json",
      },
      contents: [{
        parts: [{ text: prompt }]
      }]
    };

    if (image) {
      try {
        const base64Image = await toBase64(image);
        payload.contents[0].parts.push({
          inlineData: {
            mimeType: image.type,
            data: base64Image
          }
        });
      } catch (e) {
        showToast('Error processing image.', true);
      }
    }

    try {
      const responseText = await callGeminiApi(payload);
      const parsedResults = JSON.parse(responseText.replace(/```json|```/g, '').trim());
      setResults(parsedResults);
    } catch (e) {
      setError(`Failed to generate leads: ${e.message}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Save a lead to Firestore
  const saveIdea = async (details, genResults, lat, lng) => {
    try {
      if (!dbInstance || !userId) {
        throw new Error("Firestore or User ID not available.");
      }
      const ideasCollectionRef = collection(dbInstance, `artifacts/${appId}/users/${userId}/ideas`);
      await addDoc(ideasCollectionRef, {
        propertyDetails: details,
        latitude: lat,
        longitude: lng,
        generatedResults: JSON.stringify(genResults),
        timestamp: serverTimestamp(),
        userId: userId,
        status: 'New'
      });
      showToast('Lead saved successfully!');
    } catch (e) {
      console.error("Error adding document: ", e);
      showToast('Failed to save lead.', true);
    }
  };

  // Delete a lead from Firestore
  const deleteIdea = async (id) => {
    try {
      if (!dbInstance || !userId) {
        throw new Error("Firestore or User ID not available.");
      }
      const ideaDocRef = doc(dbInstance, `artifacts/${appId}/users/${userId}/ideas`, id);
      await deleteDoc(ideaDocRef);
      showToast('Lead deleted successfully!');
      setShowIdeaDeleteModal(false);
    } catch (e) {
      console.error("Error deleting document: ", e);
      showToast('Failed to delete lead.', true);
    }
  };

  // Update a lead's status
  const updateLeadStatus = async (id, newStatus) => {
    try {
      if (!dbInstance || !userId) {
        throw new Error("Firestore or User ID not available.");
      }
      const ideaDocRef = doc(dbInstance, `artifacts/${appId}/users/${userId}/ideas`, id);
      await updateDoc(ideaDocRef, {
        status: newStatus
      });
      showToast(`Lead status updated to "${newStatus}"!`);
    } catch (e) {
      console.error("Error updating document: ", e);
      showToast('Failed to update status.', true);
    }
  };

  // Generate offer letter with AI
  const generateOfferLetter = async (idea) => {
    setIsGeneratingOffer(true);
    const { propertyDetails, generatedResults } = idea;
    const { suggestedOfferRange } = JSON.parse(generatedResults);
    const prompt = `Write a professional and persuasive real estate offer letter for the property described as "${propertyDetails}". The suggested offer range is ${suggestedOfferRange}. The letter should be addressed to the seller, be polite, and include a call to action to contact the buyer for further discussion. It should have placeholders for the seller's name, buyer's name, and contact information. Do not use an exact dollar amount, but reference a competitive offer.`;

    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };

    try {
      const responseText = await callGeminiApi(payload);
      setOfferLetterContent(responseText);
      setShowOfferLetterModal(true);
    } catch (e) {
      showToast(`Failed to generate offer letter: ${e.message}`, true);
    } finally {
      setIsGeneratingOffer(false);
    }
  };

  // Run automated lead search (with AI)
  const runAutomatedLeadSearch = async () => {
    setIsAutoGenerating(true);
    setAutoGenProgress('Generating new leads...');
    const prompt = `Generate 5 detailed real estate investment leads, each with a property description, location, and potential value. For each lead, provide the data in a JSON object with the keys "propertyDetails", "latitude", "longitude", and "generatedResults". The "generatedResults" key should contain another JSON object with "detailedPropertySummary", "suggestedOfferRange", "buyerProfiles" (array), "sellerOutreachAngles" (array), and "dueDiligenceChecklist" (array). The full response should be a JSON array of these objects. Ensure all details are highly realistic and varied.`;

    const payload = {
      generationConfig: {
        responseMimeType: "application/json",
      },
      contents: [{
        parts: [{ text: prompt }]
      }]
    };

    try {
      const responseText = await callGeminiApi(payload);
      const newLeads = JSON.parse(responseText.replace(/```json|```/g, '').trim());

      setAutoGenProgress('Saving generated leads to Deal Flow...');
      const ideasCollectionRef = collection(dbInstance, `artifacts/${appId}/users/${userId}/ideas`);
      for (const lead of newLeads) {
        await addDoc(ideasCollectionRef, {
          propertyDetails: lead.propertyDetails,
          latitude: lead.latitude,
          longitude: lead.longitude,
          generatedResults: JSON.stringify(lead.generatedResults),
          timestamp: serverTimestamp(),
          userId: userId,
          status: 'New'
        });
      }
      showToast('Successfully generated and saved 5 new leads!');
    } catch (e) {
      showToast(`Failed to auto-generate leads: ${e.message}`, true);
      console.error(e);
    } finally {
      setIsAutoGenerating(false);
      setAutoGenProgress('');
    }
  };

  // Import mock county properties
  const importCountyProperties = async () => {
    try {
      if (!dbInstance || !userId) {
        throw new Error("Firestore or User ID not available.");
      }
      const mockCountyLeads = [
        {
          propertyDetails: "419 S Main St, Elkton, MD",
          latitude: 39.6083,
          longitude: -75.8364,
          taxAmount: 7500,
          propertyType: "Residential",
          source: 'county',
          timestamp: serverTimestamp(),
          userId: userId,
          status: 'New'
        },
        {
          propertyDetails: "Vacant lot near Big Elk Creek, Elkton, MD",
          latitude: 39.6150,
          longitude: -75.8200,
          taxAmount: 2500,
          propertyType: "Vacant Land",
          source: 'county',
          timestamp: serverTimestamp(),
          userId: userId,
          status: 'New'
        }
      ];

      const ideasCollectionRef = collection(dbInstance, `artifacts/${appId}/users/${userId}/ideas`);
      for (const lead of mockCountyLeads) {
        await addDoc(ideasCollectionRef, lead);
      }
      showToast('Successfully imported tax delinquent properties!');
    } catch (e) {
      console.error("Error importing county properties: ", e);
      showToast('Failed to import county properties.', true);
    }
  };

  // Mock function for calendar sync
  const syncToCalendar = (idea) => {
    showToast(`Successfully mocked calendar sync for "${idea.propertyDetails}"!`);
  };

  // Toggle property details
  const togglePropertyDetails = (id) => {
    setShowPropertyDetails(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Toggle idea deletion modal
  const toggleIdeaDeleteModal = (idea) => {
    setIdeaToDelete(idea);
    setShowIdeaDeleteModal(!showIdeaDeleteModal);
  };

  // Save a contact to Firestore
  const saveContact = async (contact) => {
    try {
      if (!dbInstance || !userId) {
        throw new Error("Firestore or User ID not available.");
      }
      const contactsCollectionRef = collection(dbInstance, `artifacts/${appId}/users/${userId}/contacts`);
      await addDoc(contactsCollectionRef, {
        ...contact,
        timestamp: serverTimestamp(),
        userId: userId,
      });
      showToast('Contact saved successfully!');
    } catch (e) {
      console.error("Error adding contact: ", e);
      showToast('Failed to save contact.', true);
    }
  };

  // Delete a contact from Firestore
  const deleteContact = async (id) => {
    try {
      if (!dbInstance || !userId) {
        throw new Error("Firestore or User ID not available.");
      }
      const contactDocRef = doc(dbInstance, `artifacts/${appId}/users/${userId}/contacts`, id);
      await deleteDoc(contactDocRef);
      showToast('Contact deleted successfully!');
      setShowContactDeleteModal(false);
    } catch (e) {
      console.error("Error deleting contact: ", e);
      showToast('Failed to delete contact.', true);
    }
  };

  // Toggle contact deletion modal
  const toggleContactDeleteModal = (contact) => {
    setContactToDelete(contact);
    setShowContactDeleteModal(!showContactDeleteModal);
  };

  // Run Market Analysis
  const runMarketAnalysis = async () => {
    setIsMarketAnalysisLoading(true);
    const prompt = `Analyze the following real estate comps and provide a detailed market trend analysis. Comps data: ${JSON.stringify(compsData)}. Conclude with a clear recommendation on whether the market is trending up, down, or stable.`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    try {
      const responseText = await callGeminiApi(payload);
      setMarketTrendAnalysis(responseText);
    } catch (e) {
      showToast(`Failed to run market analysis: ${e.message}`, true);
    } finally {
      setIsMarketAnalysisLoading(false);
    }
  };

  // Main UI render
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="font-sans antialiased text-gray-900 dark:text-gray-200 bg-gray-100 dark:bg-gray-900 transition-colors duration-300 min-h-screen">
      <script src="https://cdn.tailwindcss.com"></script>
      <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
      <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
      <style>
        {`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        body {
          font-family: 'Inter', sans-serif;
        }
        .prose {
          color: inherit;
        }
        .prose a {
          color: #3b82f6;
        }
        .prose img {
          border-radius: 1rem;
        }
        .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
          color: inherit;
        }
        .prose strong {
          color: inherit;
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        `}
      </style>

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row h-screen">
        {/* Sidebar Navigation */}
        <aside className="bg-white dark:bg-gray-800 lg:w-64 p-4 lg:p-6 shadow-xl border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 flex flex-row lg:flex-col justify-between items-center lg:items-start overflow-x-auto lg:overflow-y-auto">
          <div className="flex flex-row lg:flex-col space-x-4 lg:space-x-0 lg:space-y-4 w-full justify-around lg:justify-start">
            <h1 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mb-4 lg:mb-8 flex-shrink-0">
              <span className="hidden lg:inline">AIP Real Estate</span>
              <span className="lg:hidden">AIP</span>
            </h1>
            <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-3 p-3 rounded-full font-semibold transition-colors duration-200 ${activeTab === 'dashboard' ? 'bg-blue-100 text-blue-600 dark:bg-blue-700 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
              <LayoutDashboard className="w-5 h-5" />
              <span className="hidden lg:inline">Dashboard</span>
            </button>
            <button onClick={() => setActiveTab('generator')} className={`flex items-center space-x-3 p-3 rounded-full font-semibold transition-colors duration-200 ${activeTab === 'generator' ? 'bg-blue-100 text-blue-600 dark:bg-blue-700 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
              <Sparkles className="w-5 h-5" />
              <span className="hidden lg:inline">Lead Generator</span>
            </button>
            <button onClick={() => setActiveTab('dealflow')} className={`flex items-center space-x-3 p-3 rounded-full font-semibold transition-colors duration-200 ${activeTab === 'dealflow' ? 'bg-blue-100 text-blue-600 dark:bg-blue-700 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
              <ListTodo className="w-5 h-5" />
              <span className="hidden lg:inline">Deal Flow</span>
            </button>
            <button onClick={() => setActiveTab('financials')} className={`flex items-center space-x-3 p-3 rounded-full font-semibold transition-colors duration-200 ${activeTab === 'financials' ? 'bg-blue-100 text-blue-600 dark:bg-blue-700 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
              <DollarSign className="w-5 h-5" />
              <span className="hidden lg:inline">Financial Analysis</span>
            </button>
            <button onClick={() => setActiveTab('contacts')} className={`flex items-center space-x-3 p-3 rounded-full font-semibold transition-colors duration-200 ${activeTab === 'contacts' ? 'bg-blue-100 text-blue-600 dark:bg-blue-700 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
              <Users className="w-5 h-5" />
              <span className="hidden lg:inline">Contacts</span>
            </button>
          </div>
          <div className="flex items-center space-x-2 mt-4 lg:mt-auto">
            <span className="text-xs text-gray-400">User ID: {userId}</span>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
          {activeTab === 'dashboard' && <Dashboard savedIdeas={savedIdeas} savedContacts={savedContacts} />}
          {activeTab === 'generator' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <LeadGenerator
                propertyDetails={propertyDetails} setPropertyDetails={setPropertyDetails}
                latitude={latitude} setLatitude={setLatitude}
                longitude={longitude} setLongitude={setLongitude}
                imageFile={imageFile} setImageFile={setImageFile}
                findLeads={findLeads} isLoading={isLoading}
                results={results} error={error}
                showPropertyDetails={showPropertyDetails} togglePropertyDetails={togglePropertyDetails}
                saveIdea={saveIdea} userId={userId}
              />
              <MapComponent lat={parseFloat(latitude)} lng={parseFloat(longitude)} />
            </div>
          )}
          {activeTab === 'dealflow' && (
            <DealFlowManager
              savedIdeas={savedIdeas}
              deleteIdea={deleteIdea}
              togglePropertyDetails={togglePropertyDetails}
              showPropertyDetails={showPropertyDetails}
              generateOfferLetter={generateOfferLetter}
              isGeneratingOffer={isGeneratingOffer}
              toggleIdeaDeleteModal={toggleIdeaDeleteModal}
              ideaToDelete={ideaToDelete}
              showIdeaDeleteModal={showIdeaDeleteModal}
              syncToCalendar={syncToCalendar}
              runAutomatedLeadSearch={runAutomatedLeadSearch}
              isAutoGenerating={isAutoGenerating}
              autoGenProgress={autoGenProgress}
              importCountyProperties={importCountyProperties}
              updateLeadStatus={updateLeadStatus}
            />
          )}
          {activeTab === 'financials' && (
            <FinancialAnalysis
              purchasePrice={purchasePrice} setPurchasePrice={setPurchasePrice}
              salesPrice={salesPrice} setSalesPrice={setSalesPrice}
              closingCosts={closingCosts} setClosingCosts={setClosingCosts}
              rehabCosts={rehabCosts} setRehabCosts={setRehabCosts}
              holdingCosts={holdingCosts} setHoldingCosts={setHoldingCosts}
              showAdvancedAnalysis={showAdvancedAnalysis} setShowAdvancedAnalysis={setShowAdvancedAnalysis}
              marketTrendAnalysis={marketTrendAnalysis} isMarketAnalysisLoading={isMarketAnalysisLoading}
              runMarketAnalysis={runMarketAnalysis}
              compsData={compsData} setCompsData={setCompsData}
              compsInput={compsInput} setCompsInput={setCompsInput}
            />
          )}
          {activeTab === 'contacts' && (
            <ContactManager
              sellerName={sellerName} setSellerName={setSellerName}
              sellerPhone={sellerPhone} setSellerPhone={setSellerPhone}
              sellerEmail={sellerEmail} setSellerEmail={setSellerEmail}
              savedContacts={savedContacts}
              saveContact={saveContact}
              deleteContact={deleteContact}
              showContactDeleteModal={showContactDeleteModal}
              contactToDelete={contactToDelete}
              toggleContactDeleteModal={toggleContactDeleteModal}
            />
          )}
        </main>
      </div>
      <DocumentModal
        show={showOfferLetterModal}
        title="Generated Offer Letter"
        content={offerLetterContent}
        onClose={() => setShowOfferLetterModal(false)}
      />
    </div>
  );
};

export default App;