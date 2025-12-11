import React, { useMemo } from 'react';
import { FiCheckCircle, FiClock, FiUser } from 'react-icons/fi';

// Time slots configuration matching the visual design
// Striped pattern for child/male slots: bg-gradient-to-r from-yellow-100 to-blue-100
const TIME_SLOTS = [
  // 10:00 - Slot 1: child/male (striped), Slot 2: female
  { time: '10:00', slot1Type: 'child-male', slot1Color: 'bg-gradient-to-r from-yellow-100 to-blue-100', slot1BorderColor: 'border-yellow-300', slot1Label: 'Child/Male',
                    slot2Type: 'female', slot2Color: 'bg-pink-100', slot2BorderColor: 'border-pink-200', slot2Label: 'Female' },

  // 10:30 - Slot 1: child/male (striped), Slot 2: child/male (striped)
  { time: '10:30', slot1Type: 'child-male', slot1Color: 'bg-gradient-to-r from-yellow-100 to-blue-100', slot1BorderColor: 'border-yellow-300', slot1Label: 'Child/Male',
                    slot2Type: 'child-male', slot2Color: 'bg-gradient-to-r from-yellow-100 to-blue-100', slot2BorderColor: 'border-yellow-300', slot2Label: 'Child/Male' },

  // 11:00 - Slot 1: female, Slot 2: child/male (striped)
  { time: '11:00', slot1Type: 'female', slot1Color: 'bg-pink-100', slot1BorderColor: 'border-pink-200', slot1Label: 'Female',
                    slot2Type: 'child-male', slot2Color: 'bg-gradient-to-r from-yellow-100 to-blue-100', slot2BorderColor: 'border-yellow-300', slot2Label: 'Child/Male' },

  // 11:30 - Slot 1: female, Slot 2: female
  { time: '11:30', slot1Type: 'female', slot1Color: 'bg-pink-100', slot1BorderColor: 'border-pink-200', slot1Label: 'Female',
                    slot2Type: 'female', slot2Color: 'bg-pink-100', slot2BorderColor: 'border-pink-200', slot2Label: 'Female' },

  // 12:00 - Slot 1: child/male (striped), Slot 2: male
  { time: '12:00', slot1Type: 'child-male', slot1Color: 'bg-gradient-to-r from-yellow-100 to-blue-100', slot1BorderColor: 'border-yellow-300', slot1Label: 'Child/Male',
                    slot2Type: 'male', slot2Color: 'bg-blue-100', slot2BorderColor: 'border-blue-200', slot2Label: 'Male' },

  // 12:30 - Slot 1: female, Slot 2: female
  { time: '12:30', slot1Type: 'female', slot1Color: 'bg-pink-100', slot1BorderColor: 'border-pink-200', slot1Label: 'Female',
                    slot2Type: 'female', slot2Color: 'bg-pink-100', slot2BorderColor: 'border-pink-200', slot2Label: 'Female' },

  // 13:00 - Slot 1: blank, Slot 2: blank
  { time: '13:00', slot1Type: 'blank', slot1Color: 'bg-gray-50', slot1BorderColor: 'border-gray-300', slot1Label: 'Unavailable',
                    slot2Type: 'blank', slot2Color: 'bg-gray-50', slot2BorderColor: 'border-gray-300', slot2Label: 'Unavailable' },

  // 13:30 - Slot 1: female, Slot 2: male/child (striped)
  { time: '13:30', slot1Type: 'female', slot1Color: 'bg-pink-100', slot1BorderColor: 'border-pink-200', slot1Label: 'Female',
                    slot2Type: 'child-male', slot2Color: 'bg-gradient-to-r from-yellow-100 to-blue-100', slot2BorderColor: 'border-yellow-300', slot2Label: 'Male/Child' },

  // 14:00 - Slot 1: male/child (striped), Slot 2: male/child (striped)
  { time: '14:00', slot1Type: 'child-male', slot1Color: 'bg-gradient-to-r from-yellow-100 to-blue-100', slot1BorderColor: 'border-yellow-300', slot1Label: 'Male/Child',
                    slot2Type: 'child-male', slot2Color: 'bg-gradient-to-r from-yellow-100 to-blue-100', slot2BorderColor: 'border-yellow-300', slot2Label: 'Male/Child' },

  // 14:30 - Slot 1: female, Slot 2: male/child (striped)
  { time: '14:30', slot1Type: 'female', slot1Color: 'bg-pink-100', slot1BorderColor: 'border-pink-200', slot1Label: 'Female',
                    slot2Type: 'child-male', slot2Color: 'bg-gradient-to-r from-yellow-100 to-blue-100', slot2BorderColor: 'border-yellow-300', slot2Label: 'Male/Child' },

  // 15:00 - Slot 1: female, Slot 2: female
  { time: '15:00', slot1Type: 'female', slot1Color: 'bg-pink-100', slot1BorderColor: 'border-pink-200', slot1Label: 'Female',
                    slot2Type: 'female', slot2Color: 'bg-pink-100', slot2BorderColor: 'border-pink-200', slot2Label: 'Female' },

  // 15:30 - Slot 1: male/child (striped), Slot 2: male/child (striped) - No female after 3:30pm
  { time: '15:30', slot1Type: 'child-male', slot1Color: 'bg-gradient-to-r from-yellow-100 to-blue-100', slot1BorderColor: 'border-yellow-300', slot1Label: 'Male/Child',
                    slot2Type: 'child-male', slot2Color: 'bg-gradient-to-r from-yellow-100 to-blue-100', slot2BorderColor: 'border-yellow-300', slot2Label: 'Male/Child' },

  // 16:00 - Slot 1: male, Slot 2: male
  { time: '16:00', slot1Type: 'male', slot1Color: 'bg-blue-100', slot1BorderColor: 'border-blue-200', slot1Label: 'Male',
                    slot2Type: 'male', slot2Color: 'bg-blue-100', slot2BorderColor: 'border-blue-200', slot2Label: 'Male' },

  // 16:30 - Slot 1: male, Slot 2: male
  { time: '16:30', slot1Type: 'male', slot1Color: 'bg-blue-100', slot1BorderColor: 'border-blue-200', slot1Label: 'Male',
                    slot2Type: 'male', slot2Color: 'bg-blue-100', slot2BorderColor: 'border-blue-200', slot2Label: 'Male' }
];

const SlotCalendar = ({ selectedDate, events, blockedSlots = [], onSlotClick, onEventClick }) => {
  // PERFORMANCE: Index events by date+time+slot once per render
  const eventsBySlot = useMemo(() => {
    if (!events || events.length === 0) return new Map();
    
    const dateStr = selectedDate.toISOString().split('T')[0];
    const index = new Map();
    
    events.forEach(event => {
      if (!event.date_booked) return;
      const eventDateStr = new Date(event.date_booked).toISOString().split('T')[0];
      if (eventDateStr !== dateStr) return;
      
      const key = `${event.time_booked || ''}_${event.booking_slot || 1}`;
      index.set(key, event);
    });
    
    return index;
  }, [events, selectedDate]);

  // PERFORMANCE: Index blocked slots by date once per render
  const blockedSlotsByDate = useMemo(() => {
    if (!blockedSlots || blockedSlots.length === 0) return new Map();
    
    const index = new Map();
    blockedSlots.forEach(block => {
      const blockDateStr = new Date(block.date).toISOString().split('T')[0];
      if (!index.has(blockDateStr)) {
        index.set(blockDateStr, []);
      }
      index.get(blockDateStr).push(block);
    });
    return index;
  }, [blockedSlots]);

  // Check if a slot is blocked - OPTIMIZED: Use pre-indexed map
  const isSlotBlocked = (timeSlot = null, slotNumber = null) => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const dayBlocks = blockedSlotsByDate.get(dateStr) || [];
    
    if (dayBlocks.length === 0) return false;
    
    return dayBlocks.some(block => {
      // Full day block
      if (!block.time_slot) {
        // If checking a specific slot number
        if (slotNumber && block.slot_number) {
          return parseInt(block.slot_number) === parseInt(slotNumber);
        }
        // If block has no slot_number, both slots are blocked
        if (!block.slot_number) {
          return true;
        }
      }
      
      // Specific time slot block
      if (timeSlot && block.time_slot === timeSlot) {
        if (slotNumber && block.slot_number) {
          return parseInt(block.slot_number) === parseInt(slotNumber);
        }
        if (!block.slot_number) {
          return true;
        }
      }
      
      return false;
    });
  };

  // Group events by time and slot - OPTIMIZED: Use pre-indexed map
  const getEventForSlot = (time, slot) => {
    const key = `${time}_${slot}`;
    return eventsBySlot.get(key) || null;
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

  // Get cell background based on booking status and blocked state
  const getCellBackground = (slotConfig, event, time, slotNumber) => {
    // Check if slot is blocked first - blocked slots are always grey
    if (isSlotBlocked(time, slotNumber)) {
      return 'bg-gray-300 opacity-60'; // Greyed out for blocked slots
    }

    // Get the appropriate color for this specific slot
    const slotColor = slotNumber === 1 ? slotConfig.slot1Color : slotConfig.slot2Color;

    if (!event) return slotColor;

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
            <span>Male</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-pink-100 border border-pink-200 rounded mr-2"></div>
            <span>Female</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gradient-to-r from-yellow-100 to-blue-100 border border-yellow-300 rounded mr-2"></div>
            <span>Child/Male</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-50 border border-gray-300 rounded mr-2"></div>
            <span>Unavailable</span>
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
                className={`p-4 border-r border-gray-300 ${getCellBackground(slotConfig, slot1Event, slotConfig.time, 1)} ${slotConfig.slot1BorderColor} ${isSlotBlocked(slotConfig.time, 1) || slotConfig.slot1Type === 'blank' ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-80'} transition-opacity min-h-[80px] flex items-center justify-center`}
                onClick={() => {
                  if (isSlotBlocked(slotConfig.time, 1) || slotConfig.slot1Type === 'blank') return; // Don't allow clicks on blocked/blank slots
                  slot1Event ? onEventClick(slot1Event) : onSlotClick(slotConfig.time, 1, slotConfig);
                }}
              >
                {isSlotBlocked(slotConfig.time, 1) ? (
                  <div className="text-center w-full">
                    <div className="font-semibold text-gray-600 flex items-center justify-center">
                      <span className="text-xs">🔒 Blocked</span>
                    </div>
                  </div>
                ) : slotConfig.slot1Type === 'blank' ? (
                  <div className="text-center w-full">
                    <div className="font-semibold text-gray-500 flex items-center justify-center">
                      <span className="text-xs">Unavailable</span>
                    </div>
                  </div>
                ) : slot1Event ? (
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
                className={`p-4 ${getCellBackground(slotConfig, slot2Event, slotConfig.time, 2)} ${slotConfig.slot2BorderColor} ${isSlotBlocked(slotConfig.time, 2) || slotConfig.slot2Type === 'blank' ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-80'} transition-opacity min-h-[80px] flex items-center justify-center`}
                onClick={() => {
                  if (isSlotBlocked(slotConfig.time, 2) || slotConfig.slot2Type === 'blank') return; // Don't allow clicks on blocked/blank slots
                  slot2Event ? onEventClick(slot2Event) : onSlotClick(slotConfig.time, 2, slotConfig);
                }}
              >
                {isSlotBlocked(slotConfig.time, 2) ? (
                  <div className="text-center w-full">
                    <div className="font-semibold text-gray-600 flex items-center justify-center">
                      <span className="text-xs">🔒 Blocked</span>
                    </div>
                  </div>
                ) : slotConfig.slot2Type === 'blank' ? (
                  <div className="text-center w-full">
                    <div className="font-semibold text-gray-500 flex items-center justify-center">
                      <span className="text-xs">Unavailable</span>
                    </div>
                  </div>
                ) : slot2Event ? (
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

