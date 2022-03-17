"use strict";
/*
   Copyright (C) 2012 by Jeremy P. White <jwhite@codeweavers.com>

   This file is part of spice-html5.

   spice-html5 is free software: you can redistribute it and/or modify
   it under the terms of the GNU Lesser General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   spice-html5 is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU Lesser General Public License for more details.

   You should have received a copy of the GNU Lesser General Public License
   along with spice-html5.  If not, see <http://www.gnu.org/licenses/>.
*/

/*--------------------------------------------------------------------------------------
**  SpiceWireReader
**      This class will receive messages from a WebSocket and relay it to a given
**  callback.  It will optionally save and pass along a header, useful in processing
**  the mini message format.
**--------------------------------------------------------------------------------------*/

import { DEBUG } from './utils.js';
import { combine_array_buffers } from './utils.js';

function SpiceWireReader(sc, callback)
{
    this.sc = sc;
    this.callback = callback;
    this.needed = 0;

    this.buffers = [];

    this.sc.ws.wire_reader = this;
    this.sc.ws.binaryType = "arraybuffer";
    // 新消息监听
    this.sc.ws.addEventListener('message', wire_blob_catcher);
}

SpiceWireReader.prototype =
{

    /*------------------------------------------------------------------------
    **  Process messages coming in from our WebSocket
    **----------------------------------------------------------------------*/
    inbound: function (mb)
    {
        var at;
        DEBUG > 0 && console.log(`this.needed: ${this.needed}`);
        /* Just buffer if we don't need anything yet */
        // 无数据需求，直接存储
        if (this.needed == 0)
        {
            this.buffers.push(mb);
            return;
        }

        /* Optimization - if we have just one inbound block, and it's
            suitable for our needs, just use it.  */
        // 没有累积数据，当前数据长度大于等于所需
        if (this.buffers.length == 0 && mb.byteLength >= this.needed)
        {   
            // 当前数据大于所需
            if (mb.byteLength > this.needed)
            {
                this.buffers.push(mb.slice(this.needed));
                mb = mb.slice(0, this.needed);
            }
            this.callback.call(this.sc, mb,
                        this.saved_msg_header || undefined);
        }
        else
        {
            this.buffers.push(mb);
        }


        /* If we have fragments that add up to what we need, combine them */
        /*  FIXME - it would be faster to revise the processing code to handle
        **          multiple fragments directly.  Essentially, we should be
        **          able to do this without any slice() or combine_array_buffers() calls */
        while (this.buffers.length > 1 && this.buffers[0].byteLength < this.needed)
        {
            var mb1 = this.buffers.shift();
            var mb2 = this.buffers.shift();

            this.buffers.unshift(combine_array_buffers(mb1, mb2));
        }


        while (this.buffers.length > 0 && this.buffers[0].byteLength >= this.needed)
        {
            mb = this.buffers.shift();
            if (mb.byteLength > this.needed)
            {
                this.buffers.unshift(mb.slice(this.needed));
                mb = mb.slice(0, this.needed);
            }
            this.callback.call(this.sc, mb,
                        this.saved_msg_header || undefined);
        }

    },

    request: function(n)
    {
        this.needed = n;
    },

    save_header: function(h)
    {
        this.saved_msg_header = h;
    },

    clear_header: function()
    {
        this.saved_msg_header = undefined;
    },
}
// handle新消息
function wire_blob_catcher(e)
{
    DEBUG > 1 && console.log(">> WebSockets.onmessage");
    DEBUG > 1 && console.log("id " + this.wire_reader.sc.connection_id +"; type " + this.wire_reader.sc.type);
    DEBUG > 1 && console.log("e " + JSON.stringify(e));
    SpiceWireReader.prototype.inbound.call(this.wire_reader, e.data);
}

export {
  SpiceWireReader,
};
