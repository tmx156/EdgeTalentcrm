import React from 'react';
import { FiCheckCircle, FiClock, FiUser } from 'react-icons/fi';

// Time slots configuration matching the visual design
const TIME_SLOTS = [
  { time: '10:00', type: 'male', color: 'bg-blue-100', borderColor: 'border-blue-200', label: 'Male Bookings' },
  { time: '10:30', type: 'male', color: 'bg-blue-100', borderColor: 'border-blue-200', label: 'Male Bookings' },
  { time: '11:00', type: 'female', color: 'bg-pink-100', borderColor: 'border-pink-200', label: 'Female Bookings' },
  { time: '11:30', type: 'female', color: 'bg-pink-100', borderColor: 'border-pink-200', label: 'Female Bookings' },
  { time: '12:00', type: 'family', color: 'bg-yellow-100', borderColor: 'border-yellow-200', label: 'Family Bookings' },
  { time: '12:30', type: 'family', color: 'bg-yellow-100', borderColor: 'border-yellow-200', label: 'Family Bookings' },
  { time: '13:00', type: 'family', color: 'bg-yellow-100', borderColor: 'border-yellow-200', label: 'Family Bookings' },
  { time: '13:30', type: 'family', color: 'bg-yellow-100', borderColor: 'border-yellow-200', label: 'Family Bookings' },
  { time: '14:00', type: 'family', color: 'bg-yellow-100', borderColor: 'border-yellow-200', label: 'Family Bookings' },
  { time: '14:30', type: 'family', color: 'bg-yellow-100', borderColor: 'border-yellow-200', label: 'Family Bookings' },
  { time: '15:00', type: 'available', color: 'bg-white', borderColor: 'border-gray-200', label: 'Available' },
  { time: '15:30', type: 'available', color: 'bg-white', borderColor: 'border-gray-200', label: 'Available' },
  { time: '16:00', type: 'available', color: 'bg-white', borderColor: 'border-gray-200', label: 'Available' },
  { time: '16:30', type: 'available', color: 'bg-white', borderColor: 'border-gray-200', label: 'Available' }
];

const SlotCalendar = ({ selectedDate, events, onSlotClick, onEventClick }) => {
  // Group events by time and slot
  const getEventForSlot = (time, slot) => {
    if (!events || events.length === 0) return null;
    
    return events.find(event => {
      const eventTime = event.time_booked || '';
      const eventSlot = event.booking_slot || 1;
      return eventTime === time && eventSlot === slot;
    });
  };

  // Get status indicator
  const getStatusIndicator = (event) => {
    if (!event) return null;
    
    if (event.is_confirmed) {
      return <FiCheckCircle className="inline-block w-4 h-4 text-green-600 mr-1" />;
    }
    
    if (event.booking_status === 'Arrived') {
      return <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2"></span>;
    }
    
    if (event.booking_status === 'Left') {
      return <span className="inline-block w-2 h-2 rounded-full bg-black mr-2"></span>;
    }
    
    return <FiClock className="inline-block w-4 h-4 text-orange-500 mr-1" />;
  };

  // Get cell background based on booking status
  const getCellBackground = (slotConfig, event) => {
    if (!event) return slotConfig.color;
    
    // Booked slots get a slightly darker shade
    if (event.has_sale) return 'bg-blue-200'; // Sale made
    if (event.is_confirmed) return 'bg-green-50'; // Confirmed
    if (event.booking_status === 'Arrived') return 'bg-red-50'; // Arrived
    if (event.booking_status === 'Left') return 'bg-gray-100'; // Left
    
    return 'bg-orange-50'; // Unconfirmed
  };

  return (
    <div className="slot-calendar-container">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {selectedDate.toLocaleDateString('en-GB', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </h2>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded mr-2"></div>
            <span>Male Bookings</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-pink-100 border border-pink-200 rounded mr-2"></div>
            <span>Female Bookings</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded mr-2"></div>
            <span>Family Bookings</span>
          </div>
          <div className="flex items-center">
            <FiCheckCircle className="w-4 h-4 text-green-600 mr-2" />
            <span>Confirmed</span>
          </div>
          <div className="flex items-center">
            <FiClock className="w-4 h-4 text-orange-500 mr-2" />
            <span>Unconfirmed</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="slot-calendar-grid border border-gray-300 rounded-lg overflow-hidden shadow-sm">
        {/* Header Row */}
        <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-300">
          <div className="p-3 font-semibold text-center border-r border-gray-300">TIME</div>
          <div className="p-3 font-semibold text-center border-r border-gray-300">SLOT 1</div>
          <div className="p-3 font-semibold text-center">SLOT 2</div>
        </div>

        {/* Time Slot Rows */}
        {TIME_SLOTS.map((slotConfig, index) => {
          const slot1Event = getEventForSlot(slotConfig.time, 1);
          const slot2Event = getEventForSlot(slotConfig.time, 2);

          return (
            <div 
              key={slotConfig.time} 
              className={`grid grid-cols-3 border-b border-gray-200 ${index === TIME_SLOTS.length - 1 ? 'border-b-0' : ''}`}
            >
              {/* Time Column */}
              <div className="p-4 font-medium text-center border-r border-gray-300 bg-gray-50 flex items-center justify-center">
                {slotConfig.time}
              </div>

              {/* Slot 1 */}
              <div
                className={`p-4 border-r border-gray-300 ${getCellBackground(slotConfig, slot1Event)} ${slotConfig.borderColor} cursor-pointer hover:opacity-80 transition-opacity min-h-[80px] flex items-center justify-center`}
                onClick={() => slot1Event ? onEventClick(slot1Event) : onSlotClick(slotConfig.time, 1, slotConfig)}
              >
                {slot1Event ? (
                  <div className="text-center w-full">
                    <div className="font-semibold text-gray-800 flex items-center justify-center">
                      {getStatusIndicator(slot1Event)}
                      <span className="truncate">{slot1Event.name}</span>
                    </div>
                    {slot1Event.phone && (
                      <div className="text-xs text-gray-600 mt-1">{slot1Event.phone}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm text-center">
                    Click to Book
                  </div>
                )}
              </div>

              {/* Slot 2 */}
              <div
                className={`p-4 ${getCellBackground(slotConfig, slot2Event)} ${slotConfig.borderColor} cursor-pointer hover:opacity-80 transition-opacity min-h-[80px] flex items-center justify-center`}
                onClick={() => slot2Event ? onEventClick(slot2Event) : onSlotClick(slotConfig.time, 2, slotConfig)}
              >
                {slot2Event ? (
                  <div className="text-center w-full">
                    <div className="font-semibold text-gray-800 flex items-center justify-center">
                      {getStatusIndicator(slot2Event)}
                      <span className="truncate">{slot2Event.name}</span>
                    </div>
                    {slot2Event.phone && (
                      <div className="text-xs text-gray-600 mt-1">{slot2Event.phone}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm text-center">
                    Click to Book
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SlotCalendar;

